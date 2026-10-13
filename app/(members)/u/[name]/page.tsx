import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser, usernameKey } from '@/lib/auth';
import { memberInvite, inviteUrl } from '@/lib/invites';
import { stickerSvg } from '@/lib/sticker';
import { ago, date } from '@/lib/format';
import { boardBySlug } from '@/lib/config';
import Avatar from '@/components/Avatar';
import RichText from '@/components/RichText';
import ListingGrid from '@/components/ListingGrid';
import type { ThreadRow } from '@/components/ThreadRows';
import { repLine } from '@/components/DealBox';
import { reputation } from '@/lib/market';

type Profile = {
  id: number; username: string; created_at: string; last_seen_at: string | null; is_admin: boolean; bio: string | null;
  via_kind: string | null; via_batch: string | null; inviter: string | null;
  threads: number; replies: number; invited: number; props: number;
};
type Activity = { kind: 'thread' | 'reply'; thread_id: number; title: string; board: string; post_id: number | null; at: string };

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return { title: decodeURIComponent((await params).name) };
}

export default async function ProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const me = await requireUser();
  const name = decodeURIComponent((await params).name);

  const p = await one<Profile>(
    `SELECT u.id, u.username, u.created_at, u.last_seen_at, u.is_admin, u.bio,
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
        FROM threads t WHERE t.user_id = $1 AND NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now()))
     UNION ALL
     (SELECT 'reply', t.id, t.title, t.board, p.id, p.created_at
        FROM posts p JOIN threads t ON t.id = p.thread_id
       WHERE p.user_id = $1 AND NOT p.deleted AND NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now()))
     ORDER BY at DESC LIMIT 25`,
    [p.id],
  );

  // Market record: deals, feedback others left, and what they're selling now.
  const [rep, listings, feedback] = await Promise.all([
    reputation(p.id),
    q<ThreadRow>(
      `SELECT t.id, t.title, t.board, t.topic, $2::text AS author, t.reply_count, t.last_post_at, t.created_at, t.price, t.status, t.expires_at,
              substring(t.body from '\\[img:([A-Za-z0-9_-]{16})\\]') AS cover
         FROM listings l JOIN threads t ON t.id = l.thread_id
        WHERE l.seller_id = $1 AND NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now()) AND t.status = 'open'
        ORDER BY t.created_at DESC LIMIT 8`,
      [p.id, p.username],
    ),
    q<{ id: number; rating: string; note: string | null; who: string | null; as_seller: boolean; at: string }>(
      `SELECT d.id, CASE WHEN d.seller_id = $1 THEN d.buyer_rating ELSE d.seller_rating END AS rating,
              CASE WHEN d.seller_id = $1 THEN d.buyer_note ELSE d.seller_note END AS note,
              m.username AS who, d.seller_id = $1 AS as_seller, COALESCE(d.completed_at, d.updated_at) AS at
         FROM deals d LEFT JOIN members m ON m.id = CASE WHEN d.seller_id = $1 THEN d.buyer_id ELSE d.seller_id END
        WHERE (d.seller_id = $1 AND d.buyer_rating IS NOT NULL) OR (d.buyer_id = $1 AND d.seller_rating IS NOT NULL)
        ORDER BY at DESC LIMIT 5`,
      [p.id],
    ),
  ]);

  const invite = own ? await memberInvite(me.id) : null;
  const url = invite ? inviteUrl(invite.code) : '';
  const svg = invite && !invite.used_by ? stickerSvg({ url, code: invite.code }) : '';

  const via =
    p.via_kind === 'member' && p.inviter ? <>Invited by <Link className="dot" href={`/u/${encodeURIComponent(p.inviter)}`}>{p.inviter}</Link></>
    : p.via_kind === 'sticker' ? <>Via sticker</>
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
          {own && <Link className="btn" href="/settings">Edit profile</Link>}
        </div>
      </div>
      {p.bio && <RichText text={p.bio} className="body bio" />}
      <div className="stats mono mute">
        <span><b>{p.threads}</b>Threads</span>
        <span><b>{p.replies}</b>Comments</span>
        <span><b>{p.props}</b>Likes</span>
        <span><b>{p.invited}</b>Invited</span>
      </div>

      {(rep.sold + rep.bought + rep.unpaid > 0 || listings.length > 0 || own) && (
        <section className="section market-profile">
          <div className="sec-head mono">
            <span className="br">Market</span>
            <span>{repLine(rep)}{own && <> / <Link href="/market">Your market &rarr;</Link></>}</span>
          </div>
          {listings.length > 0 && <ListingGrid rows={listings} empty="" />}
          {feedback.length > 0 && (
            <ul className="fb-list">
              {feedback.map((f) => (
                <li key={f.id}>
                  <span className={`pill mono${f.rating === 'good' ? ' on' : ' bad'}`}>{f.rating === 'good' ? 'Good' : 'Bad'}</span>
                  <span className="fb-note">{f.note ?? <span className="mute">No note</span>}</span>
                  <span className="mono mute">{f.as_seller ? 'Buyer' : 'Seller'} {f.who ?? 'gone'} / {ago(f.at)}</span>
                </li>
              ))}
            </ul>
          )}
          {own && !listings.length && rep.sold + rep.bought === 0 && <p className="empty mono">Nothing listed. <Link href="/forum/market/new">New listing &rarr;</Link></p>}
        </section>
      )}

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
          ) : <p className="empty mono">No posts.</p>}
        </section>

        {own && invite && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="box">
              <div className="bh mono"><span className="br">Invite</span><Link className="mute" href="/invite">Open &rarr;</Link></div>
              <div className="bb">
                {invite.used_by ? (
                  <p style={{ margin: 0 }}>Used by <Link className="dot" href={`/u/${encodeURIComponent(invite.used_by_name ?? '')}`}>{invite.used_by_name}</Link>.</p>
                ) : (
                  <Link href="/invite" className="mini-invite">
                    <span className="mini-sticker" dangerouslySetInnerHTML={{ __html: svg }} />
                    <span>
                      <span style={{ display: 'block', color: 'var(--bone)' }}>Single use.</span>
                      <span className="mono mute">Download or share &rarr;</span>
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
