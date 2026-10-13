import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { placeName } from '@/lib/config';
import { ago } from '@/lib/format';
import { plain } from '@/lib/media-token';
import Avatar from '@/components/Avatar';

export const metadata = { title: 'Search' };

type Hit = { thread_id: number; post_id: number | null; title: string; board: string; topic: string | null; author: string | null; snippet: string; at: string };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireUser();
  const term = ((await searchParams).q ?? '').trim().slice(0, 80);
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  // "#riso" finds the tag #riso (not #risograph); anything else is a plain substring search.
  const tag = /^#([A-Za-z][A-Za-z0-9_]{1,29})$/.exec(term);
  const match = (col: string) => (tag ? `${col} ~* $1` : `${col} ILIKE $1`);
  const pattern = tag ? `#${tag[1]}([^A-Za-z0-9_]|$)` : like;
  const who = `%${term.replace(/^@/, '').replace(/[\\%_]/g, (c) => `\\${c}`)}%`.toLowerCase();
  const [hits, people] = term.length >= 2
    ? await Promise.all([
        q<Hit>(
          `(SELECT t.id AS thread_id, NULL::int AS post_id, t.title, t.board, t.topic, u.username AS author, left(t.body, 200) AS snippet, t.created_at AS at
              FROM threads t LEFT JOIN members u ON u.id = t.user_id
             WHERE NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now()) AND (${match('t.title')} OR ${match('t.body')})
               AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $2 AND b.blocked_id = t.user_id))
           UNION ALL
           (SELECT t.id, p.id, t.title, t.board, t.topic, u.username, left(p.body, 200), p.created_at
              FROM posts p JOIN threads t ON t.id = p.thread_id LEFT JOIN members u ON u.id = p.user_id
             WHERE NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now()) AND NOT p.deleted AND ${match('p.body')}
               AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $2 AND b.blocked_id = p.user_id))
           ORDER BY at DESC LIMIT 40`,
          [pattern, me.id],
        ),
        q<{ username: string }>('SELECT username FROM members WHERE username_key LIKE $1 AND NOT banned ORDER BY username_key LIKE $2 DESC, username LIMIT 24', [who, who.slice(1)]),
      ])
    : [[], []];

  return (
    <>
      <div className="head"><h1 className="title">Search</h1></div>
      <form className="searchbar" action="/search" role="search">
        <label className="sr" htmlFor="q">Search threads, comments and members</label>
        <input className="input" id="q" name="q" type="search" defaultValue={term} placeholder="Threads, comments, @members" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" autoFocus={!term} />
        <button className="btn" type="submit">Search</button>
      </form>

      {term.length >= 2 && (
        <>
          {people.length > 0 && (
            <section className="section mono">
              <span className="mute br" style={{ display: 'block', marginBottom: 10 }}>Members</span>
              <ul className="people">{people.map((p) => <li key={p.username}><Link href={`/u/${encodeURIComponent(p.username)}`}><Avatar name={p.username} size={24} />{p.username}</Link></li>)}</ul>
            </section>
          )}
          <section className="section">
            <span className="mono mute br">{hits.length} {hits.length === 1 ? 'result' : 'results'}</span>
            {hits.length ? (
              <ul className="rows">
                {hits.map((h) => (
                  <li key={`${h.thread_id}-${h.post_id ?? 't'}`}>
                    <Link className="row" href={`/forum/t/${h.thread_id}${h.post_id ? `#p${h.post_id}` : ''}`}>
                      <span className="t">{h.title}</span>
                      <span className="n mono">{h.post_id ? 'Comment' : 'Thread'}</span>
                      <span className="m snippet">{plain(h.snippet)}</span>
                      <span className="m mono"><span>{placeName(h.board, h.topic)}</span><span>{h.author ?? 'gone'}</span><span>{ago(h.at)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="empty mono">No results.</p>}
          </section>
        </>
      )}
    </>
  );
}
