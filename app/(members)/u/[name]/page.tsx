import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser, usernameKey } from '@/lib/auth';
import { memberInvite, inviteUrl, qrSvg } from '@/lib/invites';
import { ago, date } from '@/lib/format';
import { boardBySlug } from '@/lib/config';
import { changePassword } from '@/app/actions';
import { CopyButton } from '@/components/Buttons';
import Notice from '@/components/Notice';
import Avatar from '@/components/Avatar';

type Profile = {
  id: number; username: string; created_at: string; last_seen_at: string | null; is_admin: boolean;
  via_kind: string | null; via_batch: string | null; inviter: string | null;
  threads: number; replies: number; invited: number; props: number;
};
type Activity = { kind: 'thread' | 'reply'; thread_id: number; title: string; board: string; post_id: number | null; at: string };

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return { title: decodeURIComponent((await params).name) };
}

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const me = await requireUser();
  const name = decodeURIComponent((await params).name);
  const { error, saved } = await searchParams;

  const p = await one<Profile>(
    `SELECT u.id, u.username, u.created_at, u.last_seen_at, u.is_admin,
            i.kind AS via_kind, i.batch AS via_batch, inv.username AS inviter,
            (SELECT count(*)::int FROM threads WHERE user_id = u.id AND NOT deleted) AS threads,
            (SELECT count(*)::int FROM posts WHERE user_id = u.id AND NOT deleted) AS replies,
            (SELECT count(*)::int FROM invites WHERE created_by = u.id AND kind = 'member' AND used_by IS NOT NULL) AS invited,
            (SELECT count(*)::int FROM props pr WHERE (pr.target = 'thread' AND pr.target_id IN (SELECT id FROM threads WHERE user_id = u.id AND NOT deleted))
                                              OR (pr.target = 'post' AND pr.target_id IN (SELECT id FROM posts WHERE user_id = u.id AND NOT deleted))) AS props
       FROM members u
       LEFT JOIN invites i ON i.id = u.invited_via
       LEFT JOIN members inv ON inv.id = i.created_by AND i.kind = 'member'
      WHERE u.username_key = $1 AND NOT u.banned`,
    [usernameKey(name)],
  );
  if (!p) notFound();
  const own = p.id === me.id;

  const activity = await q<Activity>(
    `(SELECT 'thread' AS kind, t.id AS thread_id, t.title, t.board, NULL::int AS post_id, t.created_at AS at
        FROM threads t WHERE t.user_id = $1 AND NOT t.deleted)
     UNION ALL
     (SELECT 'reply', t.id, t.title, t.board, p.id, p.created_at
        FROM posts p JOIN threads t ON t.id = p.thread_id
       WHERE p.user_id = $1 AND NOT p.deleted AND NOT t.deleted)
     ORDER BY at DESC LIMIT 25`,
    [p.id],
  );

  const invite = own ? await memberInvite(me.id) : null;
  const url = invite ? inviteUrl(invite.code) : '';
  const svg = invite && !invite.used_by ? await qrSvg(url) : '';

  const via =
    p.via_kind === 'member' && p.inviter ? <>Invited by <Link className="dot" href={`/u/${encodeURIComponent(p.inviter)}`}>{p.inviter}</Link></>
    : p.via_kind === 'sticker' ? <>Found a sticker{p.via_batch ? ` (${p.via_batch})` : ''}</>
    : p.via_kind === 'setup' ? <>Founder</>
    : null;

  return (
    <>
      <div className="head">
        <div className="who-head">
          <Avatar name={p.username} size={72} />
          <div>
          <h1 className="title" style={{ overflowWrap: 'anywhere' }}>{p.username}</h1>
          <p className="sub mono mute">
            Joined {date(p.created_at)}{via ? <> / {via}</> : null}{p.last_seen_at ? <> / Seen {ago(p.last_seen_at)}</> : null}
          </p>
          </div>
        </div>
        <div className="actions">
          {p.is_admin && <span className="pill on">Admin</span>}
          {!own && <Link className="btn solid" href={`/messages/${encodeURIComponent(p.username)}`}>Message</Link>}
        </div>
      </div>
      <div className="stats mono mute">
        <span><b>{p.threads}</b>Threads</span>
        <span><b>{p.replies}</b>Comments</span>
        <span><b>{p.props}</b>Props</span>
        <span><b>{p.invited}</b>Brought in</span>
      </div>

      <div className="grid2 section">
        <section>
          <span className="mono mute br" style={{ display: 'block', marginBottom: 10 }}>Activity</span>
          {activity.length ? (
            <ul className="rows">
              {activity.map((a) => (
                <li key={`${a.kind}${a.post_id ?? a.thread_id}`}>
                  <Link className="row" href={`/forum/t/${a.thread_id}${a.post_id ? `#p${a.post_id}` : ''}`}>
                    <span className="t">{a.title}</span>
                    <span className="n mono">{a.kind === 'thread' ? 'Started' : 'Commented'}</span>
                    <span className="m mono">{boardBySlug(a.board)?.name ?? a.board} / {ago(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="empty mono">No posts yet.</p>}
        </section>

        {own && invite && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="box">
              <div className="bh mono"><span className="br">Your invite</span><span className="mute">One use</span></div>
              <div className="bb">
                {invite.used_by ? (
                  <p style={{ margin: 0 }}>Used by <Link className="dot" href={`/u/${encodeURIComponent(invite.used_by_name ?? '')}`}>{invite.used_by_name}</Link>.</p>
                ) : (
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, flex: '1 1 180px' }}>
                      <p style={{ margin: 0 }}>Pick one person. This link works once.</p>
                      <span className="code">{url}</span>
                      <div className="copy"><CopyButton text={url} /></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="box">
              <div className="bh mono"><span className="br">Password</span></div>
              <div className="bb">
                <Notice error={error} ok={saved ? 'Password changed.' : undefined} />
                <form action={changePassword} className="stack">
                  <div className="field"><label className="mono" htmlFor="current">Current</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" required /></div>
                  <div className="field"><label className="mono" htmlFor="password">New</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" required /></div>
                  <div className="field"><label className="mono" htmlFor="confirm">New again</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
                  <div className="actions"><button className="btn" type="submit">Change password</button></div>
                </form>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
