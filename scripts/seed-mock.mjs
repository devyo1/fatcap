// Fills the forum with clearly-flagged mock members and posts so it doesn't look empty.
// Remove it all later from Admin -> Overview -> "Remove all mock content".
//   node scripts/seed-mock.mjs        (uses DATABASE_URL, or LOCAL_DB)
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

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

// [board, author, hoursAgo, title, body, comments]
// comment: [author, minutesAfterThread, body, replies?]
const THREADS = [
  ['general', 'nox514', 30, 'Rain all week and I have a full bag of cans',
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
  ['general', 'kev.plateau', 52, 'What are you listening to while painting?',
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
  ['travel', 'mira.sh', 76, 'Barcelona in November: who should I link with?',
    "Going for 10 days. Mostly want to paint and skate, not do the cathedral thing. Anyone been recently?\n\nWill trade Montreal tips for Barcelona tips.",
    [
      ['lou_mileend', 45, 'The waterfront plazas are worth it for skating even if you just watch. Go early, it gets packed with tourists by noon.'],
      ['dumpsterjazz', 130, "Don't paint anything without asking someone local first. Rules there are not the same as here.", [
        ['mira.sh', 150, "Yeah that's the plan, I'd rather link with people than wing it."],
      ]],
      ['nox514', 300, 'Bring back stickers. Not optional.'],
    ]],
  ['travel', 'vicverdun', 98, 'Toronto for a weekend: worth it?',
    'Cheap train tickets this month. Is it worth going just for the skate spots, or is it all just big and grey?',
    [
      ['kev.plateau', 20, "Big and grey but the scene is good. Go to the parks, skip the downtown stuff.", [
        ['vicverdun', 35, 'Any you specifically like?'],
        ['kev.plateau', 48, "I'll DM you, too many to type."],
      ]],
      ['lou_mileend', 200, 'Eat everything. That city is a food court.'],
    ]],
  ['lifestyle', 'dumpsterjazz', 20, "Thrift on Saint-Laurent that isn't overpriced yet",
    "Everything got expensive overnight. Where are people still finding decent jackets under 30 bucks?",
    [
      ['lou_mileend', 18, "The church sales in the east end on Saturday mornings. You have to dig but it's worth it."],
      ['mira.sh', 44, 'Don\'t say it out loud, they\'ll raise prices', [
        ['dumpsterjazz', 50, 'This forum is invite only for a reason'],
        ['nox514', 66, 'Nobody tell the vintage resellers'],
      ]],
    ]],
  ['lifestyle', 'lou_mileend', 9, 'Best food after a late session, go',
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
  ['general', 'vicverdun', 4, 'Peace Park still the move on Sundays?',
    'Haven\'t been since summer. Is it still a whole crowd on Sunday afternoons or did everyone move on?',
    [
      ['lou_mileend', 15, 'Still busy. Bring your own board wax, the ledges are crusty.'],
      ['kev.plateau', 33, "I'll be there around 3 if anyone wants to link."],
    ]],
  ['general', 'mira.sh', 2, 'Sketch dump thread',
    "Post what you've been drawing. Doesn't have to be good. **Especially** if it isn't good.\n\nI'll start: three versions of the same M and I hate all of them.",
    [
      ['dumpsterjazz', 8, 'The M with the arrow coming off the leg is the one. Commit to it.'],
      ['nox514', 25, "Mine are all on the back of receipts so I can't post them, but I'm proud of them."],
    ]],
];

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

for (const [board, author, hoursAgo, title, body, tree] of THREADS) {
  const at = `${hoursAgo * 60} minutes`;
  const [t] = await query(
    `INSERT INTO threads (city, board, user_id, title, body, created_at, last_post_at)
     VALUES ($1, $2, $3, $4, $5, now() - $6::interval, now() - $6::interval) RETURNING id`,
    [CITY, board, ids[author], title, body, at],
  );
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
