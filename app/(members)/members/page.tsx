import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ago, date } from '@/lib/format';

export const metadata = { title: 'Members' };

type M = { username: string; created_at: string; last_seen_at: string | null; posts: number; is_admin: boolean };

export default async function Members() {
  await requireUser();
  const members = await q<M>(
    `SELECT u.username, u.created_at, u.last_seen_at, u.is_admin,
            (SELECT count(*)::int FROM threads WHERE user_id = u.id AND NOT deleted)
          + (SELECT count(*)::int FROM posts WHERE user_id = u.id AND NOT deleted) AS posts
       FROM members u WHERE NOT u.banned ORDER BY u.last_seen_at DESC NULLS LAST LIMIT 500`,
  );

  return (
    <>
      <div className="head">
        <h1 className="title">Members</h1>
        <span className="mono mute">{members.length}</span>
      </div>
      <ul className="rows">
        {members.map((m) => (
          <li key={m.username}>
            <Link className="row" href={`/u/${encodeURIComponent(m.username)}`}>
              <span className="t">{m.username} {m.is_admin && <span className="pill on">Admin</span>}</span>
              <span className="n mono">{m.posts} posts</span>
              <span className="m mono"><span>Joined {date(m.created_at)}</span>{m.last_seen_at && <span>Seen {ago(m.last_seen_at)}</span>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
