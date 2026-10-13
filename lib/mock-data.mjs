// Mock content: clearly flagged members with threads in every sub-forum, Market listings
// (zines with sample pages, an auction with bids, offers, finished deals with feedback),
// profile pictures and #tags. Used by `node scripts/seed-mock.mjs` and Admin -> "Add mock content".
//
// Safe to run again: anything already there (same title by the same mock member) is left as it is,
// apart from putting older mock threads into their sub-forum. Remove it all from Admin.
import { randomBytes } from 'node:crypto';

const MEMBERS = ['nox514', 'kev.plateau', 'mira.sh', 'dumpsterjazz', 'vicverdun', 'lou_mileend', 'oddhours', 'ruefroide'];

// Profile pictures for a few of them: [username, bg, ink, shape]
const PICS = [['mira.sh', '#e4e1d9', '#FF5A1F', 0], ['oddhours', '#1d1c1a', '#FF5A1F', 1], ['kev.plateau', '#3D6BFF', '#e4e1d9', 2], ['ruefroide', '#c8b49a', '#1d1c1a', 0]];

// [board/sub, author, hoursAgo, title, body, comments, extra?]
//   comment: [author, minutesAfterThread, body, replies?]
//   extra: { cover: [bg, ink, accent, shape], pages: n, photos: [[bg, ink, accent, caption]], listing: {...},
//            bids: [[who, cents, minutesAgo]], offers: [[who, cents, note]], deals: [[buyer, cents, rating, note, daysAgo]] }
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
      deals: [['lou_mileend', 4000, 'good', 'Print is even better in person.', 5]],
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
  // ---- added with the sub-forums: something in every corner ----
  ['general/introductions', 'oddhours', 50, 'Hi from Verdun',
    'Found the invite on a sticker on a pole on Wellington. Mostly here for the zines and the photo threads. I print small runs on a riso when the machine cooperates.\n\nGood to be in.',
    [
      ['mira.sh', 30, 'Welcome. Post the riso stuff in Print, people here will want it.'],
      ['vicverdun', 90, 'Verdun. Which pole?', [
        ['oddhours', 110, 'Not saying. Someone else might find the next one.'],
      ]],
    ]],
  ['general/introductions', 'ruefroide', 26, 'New here, mostly photos',
    "I shoot walls more than I paint them. Film when I can afford it, phone when I can't. Will post a set from Mexico City soon.",
    [['lou_mileend', 20, 'Film photos of walls is exactly what this place needs.']]],
  ['general/discussion', 'nox514', 12, 'What got you into it?',
    "Mine was a blackbook my cousin left at my place in 2008. Never gave it back. #blackbook\n\nYours?",
    [
      ['kev.plateau', 15, 'Skate videos. The parts where the camera drifts past a wall for two seconds.'],
      ['dumpsterjazz', 40, 'A teacher who told me to stop drawing letters in the margins. So I drew bigger ones.'],
      ['oddhours', 75, 'Zines first, walls later.'],
    ]],
  ['general/stories', 'kev.plateau', 70, 'The night the power went out on Saint-Denis',
    "Three summers ago the whole block went dark around eleven. We were halfway through a jam on the legal wall behind the depanneur and suddenly there was no light at all.\n\nNobody left. Someone had a bike light, someone else had candles from the dep, and we ended up in the back room with the owner, sketching on cardboard boxes until the power came back at two.\n\nThe owner still has one of those boxes on the wall behind the counter. #montreal",
    [
      ['mira.sh', 25, 'I remember that night. The candles were birthday candles.'],
      ['lou_mileend', 60, "Best jam that never got finished."],
    ]],
  ['travel/meetups', 'lou_mileend', 8, 'Blackbook night, Friday',
    'Same basement as last time. Bring paper, markers, something to drink. Starts around 9. #blackbook #montreal',
    [
      ['nox514', 20, "I'm in."],
      ['dumpsterjazz', 45, 'Bringing tracing paper this time.'],
      ['ruefroide', 70, 'First time coming. Anything I should know?', [
        ['lou_mileend', 85, 'Knock twice. Shoes off.'],
      ]],
    ]],
  ['travel/places', 'kev.plateau', 90, 'Notes on Lisbon',
    'Went in September. Short version:\n\n- the legal walls by the river are busy on weekends, go weekday mornings\n- the tram is slower than walking\n- every bakery is the best bakery\n\n#lisbon',
    [['vicverdun', 50, 'Saving this. Going in the spring.']]],
  ['travel/trips', 'ruefroide', 40, 'Two weeks in Mexico City',
    'Mostly walking, a lot of rooftops. A few frames.',
    [
      ['mira.sh', 35, 'The second one. That light.'],
      ['nox514', 80, 'Need the full set.'],
    ], { photos: [['#c8b49a', '#1d1c1a', '#3D6BFF', 'Roma Norte, early'], ['#2a2a28', '#e4e1d9', '#FF5A1F', 'Rooftop, last night'], ['#9fb3a0', '#1d1c1a', '#FF5FA2', 'Market wall, Merced']] }],
  ['lifestyle/style', 'nox514', 30, 'Paint on the good jacket',
    "Accepted it. It's part of the jacket now.",
    [
      ['dumpsterjazz', 18, 'Every good jacket has a story on the sleeve.'],
      ['kev.plateau', 44, "Mine has three colours I don't remember using."],
    ]],
  ['lifestyle/music', 'lou_mileend', 60, 'Mixes for late nights',
    'Post one mix you keep coming back to. No explanations needed.',
    [
      ['mira.sh', 22, 'Anything slow with a lot of space in it.'],
      ['oddhours', 54, 'The same Sunday radio show for six years running.'],
    ]],
  ['lifestyle/print', 'oddhours', 20, 'Riso drums in Montreal?',
    'Mine is on its last legs. Anyone know where to get a black drum looked at without shipping it to Toronto? #riso',
    [['mira.sh', 30, "There's a print shop in Mile-Ex that might. I'll ask."]]],
  ['market/zines', 'oddhours', 16, 'Night Shift, no. 1',
    'Sixteen pages, black and red riso. Photos and notes from walking home after work. Small run.\n\nAsking ten, open to trades for other zines.',
    [['ruefroide', 25, 'Would trade a print for one.']], {
      cover: ['#1d1c1a', '#e4e1d9', '#FF5A1F', 2], pages: 4,
      listing: { mode: 'offers', price: 1000, quantity: 30, trades: true, ships: true, ship: 300, shipNote: 'Canada', meetup: true, area: 'Verdun' },
      offers: [['vicverdun', 900, 'Can pick up this week.']],
    }],
  ['market/goods', 'nox514', 22, 'Spare caps, mixed lot',
    'Bag of spare caps, mixed, around forty. Clean. Meetup only.',
    [], {
      cover: ['#e4e1d9', '#0e0e0d', '#3D6BFF', 0],
      listing: { mode: 'fixed', price: 1500, quantity: 3, meetup: true, area: 'Plateau' },
      deals: [['kev.plateau', 1500, 'good', 'Easy meetup.', 2]],
    }],
  ['market/wanted', 'oddhours', 70, 'Risograph black drum',
    'Looking for a working black drum for an older riso. Will pick up anywhere on the island.',
    [], { listing: { mode: 'wanted', price: 15000 } }],
];

const fmt = (c) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);

/**
 * Add whatever mock content is missing. `query(text, params)` returns rows.
 * Returns counts of what was added.
 */
export async function seedMock(query) {
  const { default: sharp } = await import('sharp');
  const one = async (t, p) => (await query(t, p))[0] ?? null;
  const out = { members: 0, threads: 0, comments: 0, likes: 0, listings: 0, deals: 0, pictures: 0, skipped: [] };

  async function storeMedia(memberId, svg, w, h) {
    const data = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
    const id = randomBytes(12).toString('base64url');
    await query(
      `INSERT INTO media (id, member_id, data, bytes, width, height, animated, expires_at) VALUES ($1, $2, decode($3, 'base64'), $4, $5, $6, false, 'infinity')`,
      [id, memberId, data.toString('base64'), data.length, w, h],
    );
    return id;
  }
  // Abstract covers: halftone ground, one shape, three bars. No text.
  const cover = (memberId, [bg, ink, accent, shape]) => storeMedia(memberId, `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
    <defs><pattern id="d" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3.2" fill="${ink}" fill-opacity=".28"/></pattern></defs>
    <rect width="800" height="1000" fill="${bg}"/><rect width="800" height="1000" fill="url(#d)"/>${
      shape === 0 ? `<circle cx="400" cy="430" r="250" fill="${accent}"/>` : shape === 1 ? `<rect x="90" y="140" width="620" height="560" fill="${accent}"/>` : `<path d="M0 760 L800 300 L800 1000 L0 1000Z" fill="${accent}"/>`}
    <rect x="60" y="820" width="680" height="16" fill="${ink}"/><rect x="60" y="860" width="420" height="16" fill="${ink}"/>
    <rect x="60" y="900" width="260" height="16" fill="${ink}" fill-opacity=".6"/></svg>`, 800, 1000);
  // Zine sample pages: photo blocks, captions, a page number in dots.
  const page = (memberId, n) => {
    const ink = '#0e0e0d', paper = n % 3 === 0 ? '#e4e1d9' : '#ece9e1';
    const photo = n % 2
      ? `<rect x="70" y="90" width="460" height="560" fill="${ink}"/><rect x="70" y="90" width="460" height="560" fill="url(#h)"/>`
      : `<rect x="70" y="90" width="460" height="300" fill="${ink}"/><rect x="70" y="420" width="220" height="230" fill="${ink}" fill-opacity=".85"/><rect x="310" y="420" width="220" height="230" fill="#FF5A1F"/>`;
    return storeMedia(memberId, `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
      <defs><pattern id="h" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.6" fill="${paper}" fill-opacity=".35"/></pattern></defs>
      <rect width="600" height="800" fill="${paper}"/>${photo}
      <rect x="70" y="680" width="380" height="9" fill="${ink}"/><rect x="70" y="700" width="300" height="9" fill="${ink}" fill-opacity=".7"/>
      ${Array.from({ length: n + 1 }, (_, i) => `<circle cx="${520 - i * 14}" cy="745" r="4" fill="${ink}"/>`).join('')}</svg>`, 600, 800);
  };
  // Photos for a trip report: horizon, sun, a wall.
  const photo = (memberId, [bg, ink, accent]) => storeMedia(memberId, `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><pattern id="g" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" fill="${ink}" fill-opacity=".18"/></pattern></defs>
    <rect width="1200" height="800" fill="${bg}"/><circle cx="880" cy="250" r="120" fill="${accent}" fill-opacity=".9"/>
    <rect y="470" width="1200" height="330" fill="${ink}" fill-opacity=".85"/><rect x="140" y="380" width="380" height="240" fill="${ink}"/>
    <rect x="170" y="420" width="140" height="60" fill="${accent}"/><rect width="1200" height="800" fill="url(#g)"/></svg>`, 1200, 800);
  const avatar = async ([bg, ink, shape]) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" fill="${bg}"/>${shape === 0 ? `<circle cx="128" cy="128" r="70" fill="${ink}"/>` : shape === 1 ? `<rect x="60" y="60" width="136" height="136" fill="${ink}"/>` : `<path d="M0 200 L256 70 L256 256 L0 256Z" fill="${ink}"/>`}</svg>`)).webp({ quality: 82 }).toBuffer();

  // Members (reuse mock ones that exist; never touch a real member who has the same name).
  const { default: bcrypt } = await import('bcryptjs');
  const hash = await bcrypt.hash(randomBytes(24).toString('hex'), 10); // nobody can log in as a mock member
  const ids = {};
  for (const [i, name] of MEMBERS.entries()) {
    const found = await one('SELECT id, is_mock FROM members WHERE username_key = $1', [name.toLowerCase()]);
    if (found && !found.is_mock) { out.skipped.push(name); continue; }
    if (found) { ids[name] = found.id; continue; }
    const row = await one(
      `INSERT INTO members (username, username_key, password_hash, is_mock, created_at, last_seen_at)
       VALUES ($1, $2, $3, true, now() - ($4 || ' days')::interval, now() - ($5 || ' minutes')::interval) RETURNING id`,
      [name, name.toLowerCase(), hash, String(9 + i * 2), String(i < 3 ? 3 + i * 4 : 90 + i * 60)],
    );
    ids[name] = row.id; out.members++;
  }
  for (const [name, bg, ink, shape] of PICS) {
    if (!ids[name] || (await one('SELECT 1 FROM avatars WHERE member_id = $1', [ids[name]]))) continue;
    const data = await avatar([bg, ink, shape]);
    await query(`INSERT INTO avatars (member_id, data) VALUES ($1, decode($2, 'base64')) ON CONFLICT (member_id) DO NOTHING`, [ids[name], data.toString('base64')]);
    out.pictures++;
  }

  const mockIds = Object.values(ids);
  const pick = (n) => mockIds.slice().sort(() => Math.random() - 0.5).slice(0, n);

  for (const [place, author, hoursAgo, title, text, tree, extra = {}] of THREADS) {
    if (!ids[author]) continue;
    const [board, topic] = place.split('/');
    const existing = await one('SELECT id FROM threads WHERE title = $1 AND user_id = $2', [title, ids[author]]);
    if (existing) {
      // Older mock threads predate sub-forums: file them.
      await query('UPDATE threads SET board = $2, topic = $3 WHERE id = $1 AND (topic IS NULL OR board <> $2)', [existing.id, board, topic ?? null]);
      continue;
    }
    const at = `${hoursAgo * 60} minutes`;
    const images = [];
    if (extra.cover) images.push(await cover(ids[author], extra.cover));
    for (let n = 1; n <= (extra.pages ?? 0); n++) images.push(await page(ids[author], n));
    const lines = images.map((i) => `[img:${i}]`);
    for (const p of extra.photos ?? []) lines.push(`[img:${await photo(ids[author], p)}] ${p[3]}`);
    const allImages = [...images];
    const body = lines.length ? (extra.photos ? `${text}\n\n${lines.join('\n')}` : `${lines.join('\n')}\n\n${text}`) : text;
    const L = extra.listing;
    const t = await one(
      `INSERT INTO threads (city, board, topic, user_id, title, body, created_at, last_post_at, status)
       VALUES ('global', $1, $2, $3, $4, $5, now() - $6::interval, now() - $6::interval, $7) RETURNING id`,
      [board, topic ?? null, ids[author], title, body, at, L ? 'open' : null],
    );
    out.threads++;
    await query(`UPDATE media SET thread_id = $1 WHERE member_id = $2 AND thread_id IS NULL AND id = ANY($3::text[])`, [t.id, ids[author], [...allImages, ...[...body.matchAll(/\[img:([A-Za-z0-9_-]{16})\]/g)].map((m) => m[1])]]);
    await query('INSERT INTO thread_follows (member_id, thread_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ids[author], t.id]);

    let last = hoursAgo * 60;
    const add = async (list, parent) => {
      for (const [who, after, words, replies] of list) {
        if (!ids[who]) continue;
        const ago = Math.max(1, hoursAgo * 60 - after);
        const p = await one(
          `INSERT INTO posts (thread_id, user_id, body, parent_id, created_at) VALUES ($1, $2, $3, $4, now() - ($5 || ' minutes')::interval) RETURNING id`,
          [t.id, ids[who], words, parent, String(ago)],
        );
        out.comments++; last = Math.min(last, ago);
        for (const giver of pick(Math.floor(Math.random() * 4))) {
          if (giver === ids[who]) continue;
          await query(`INSERT INTO props (member_id, target, target_id) VALUES ($1, 'post', $2) ON CONFLICT DO NOTHING`, [giver, p.id]); out.likes++;
        }
        if (replies) await add(replies, p.id);
      }
    };
    await add(tree, null);
    for (const giver of pick(2 + Math.floor(Math.random() * 4))) {
      if (giver === ids[author]) continue;
      await query(`INSERT INTO props (member_id, target, target_id) VALUES ($1, 'thread', $2) ON CONFLICT DO NOTHING`, [giver, t.id]); out.likes++;
    }
    await query(
      `UPDATE threads SET reply_count = (SELECT count(*) FROM posts WHERE thread_id = $1), last_post_at = now() - ($2 || ' minutes')::interval WHERE id = $1`,
      [t.id, String(last)],
    );

    if (L) {
      const deals = (extra.deals ?? []).filter((d) => ids[d[0]]);
      await query(
        `INSERT INTO listings (thread_id, seller_id, mode, price_cents, quantity, sold_count, accept_offers, ships, ship_cents, ship_note, meetup, meetup_area, trades, ends_at, increment_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [t.id, ids[author], L.mode, L.price ?? null, L.quantity ?? 1, L.mode === 'auction' ? 0 : deals.length, !!L.offers, !!L.ships, L.ship ?? null, L.shipNote ?? null,
          !!L.meetup, L.area ?? null, !!L.trades, L.mode === 'auction' ? new Date(Date.now() + (L.days ?? 2) * 864e5) : null, L.increment ?? null],
      );
      out.listings++;
      for (const [who, cents, minutes] of extra.bids ?? []) {
        if (!ids[who]) continue;
        await query(`INSERT INTO offers (listing_id, buyer_id, kind, amount_cents, method, status, created_at) VALUES ($1, $2, 'bid', $3, 'meetup', 'active', now() - ($4 || ' minutes')::interval)`, [t.id, ids[who], cents, String(minutes)]);
      }
      for (const [who, cents, note] of extra.offers ?? []) {
        if (!ids[who]) continue;
        await query(`INSERT INTO offers (listing_id, buyer_id, kind, amount_cents, method, note) VALUES ($1, $2, 'offer', $3, 'meetup', $4)`, [t.id, ids[who], cents, note]);
      }
      for (const [who, cents, rating, note, days] of deals) {
        await query(
          `INSERT INTO deals (thread_id, title, seller_id, buyer_id, source, amount_cents, currency, method, status, paid_at, completed_at, buyer_rating, buyer_note, seller_rating, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'buy', $5, 'CAD', 'meetup', 'complete', now() - ($6 || ' days')::interval, now() - ($6 || ' days')::interval, $7, $8, 'good', now() - ($6 || ' days')::interval, now() - ($6 || ' days')::interval)`,
          [t.id, title, ids[author], ids[who], cents, String(days), rating, note],
        );
        out.deals++;
      }
      const top = Math.max(0, ...(extra.bids ?? []).map((b) => b[1]));
      const price = L.mode === 'auction' ? fmt(top || L.price) : L.mode === 'wanted' ? (L.price ? `Budget ${fmt(L.price)}` : 'Wanted') : L.price != null ? fmt(L.price) : 'Offers';
      await query('UPDATE threads SET price = $2 WHERE id = $1', [t.id, price]);
    }
  }
  return out;
}
