import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser, type User } from '@/lib/auth';
import { LIMITS, REPORT_REASONS, boardBySlug, subBySlug } from '@/lib/config';
import { LIVE } from '@/lib/threads';
import { ago, left } from '@/lib/format';
import {
  reply, deletePost, deleteThread, editPost, editThread, toggleProps, setThreadFlag, moveThread,
  toggleFollow, toggleSave, toggleSold, report,
} from '@/app/actions';
import RichText from '@/components/RichText';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';
import Writer from '@/components/Writer';
import { readingMinutes } from '@/components/RichText';
import PlacePicker from '@/components/PlacePicker';
import VanishPicker from '@/components/VanishPicker';
import QuoteButton from '@/components/QuoteButton';
import { Heart, Reply, More, Bell, Bookmark, Hourglass, Minus, Plus } from '@/components/Icons';
import DealBox, { type PendingOffer } from '@/components/DealBox';
import ListingForm from '@/components/ListingForm';
import ZineViewer, { type ZinePage } from '@/components/ZineViewer';
import { RefreshEvery } from '@/components/Live';
import Pulse from '@/components/Pulse';
import ReadingBar from '@/components/ReadingBar';
import { getListing, bidsFor, reputation, settleAuctions, auctionOpen, type Listing } from '@/lib/market';
import { updateListing } from '@/app/market-actions';
import { MEDIA_LINE, mediaIn, mediaUrl } from '@/lib/media-token';

type Thread = {
  id: number; board: string; topic: string | null; title: string; body: string; user_id: number | null; author: string | null;
  created_at: string; edited_at: string | null; reply_count: number; pinned: boolean; locked: boolean;
  expires_at: string | null; price: string | null; status: string | null;
  props: number; mine: boolean; following: boolean; saved: boolean;
};
type Post = {
  id: number; parent_id: number | null; body: string; user_id: number | null; author: string | null;
  created_at: string; edited_at: string | null; deleted: boolean; props: number; mine: boolean;
};
type Mode = { edit?: string; report?: string; move?: string };

// Comments nest this deep; replies below that stack flat under the last level.
const MAX_DEPTH = 4;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = await one<{ title: string }>(`SELECT title FROM threads t WHERE id = $1 AND ${LIVE}`, [Number((await params).id) || 0]);
  return { title: t?.title ?? 'Thread' };
}

function Author({ name }: { name: string | null }) {
  return name ? <Link className="who" href={`/u/${encodeURIComponent(name)}`}>{name}</Link> : <span className="who">gone</span>;
}

function LikeButton({ target, id, count, mine, back }: { target: 'thread' | 'post'; id: number; count: number; mine: boolean; back: string }) {
  return (
    <form action={toggleProps}>
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <button className={`act${mine ? ' on' : ''}`} type="submit" aria-pressed={mine} title={mine ? 'Unlike' : 'Like'}>
        <Heart on={mine} /><span>{count || 'Like'}</span>
      </button>
    </form>
  );
}

/** "⋯" menu for the less common actions. */
function Menu({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <details className="menu">
      <summary className="act" aria-label={label}><More /></summary>
      <div className="menu-panel mono">{children}</div>
    </details>
  );
}

function ReportForm({ threadId, postId, back }: { threadId: number; postId?: number; back: string }) {
  return (
    <form action={report} className="stack inline-form report-form">
      <input type="hidden" name="thread" value={threadId} />
      {postId && <input type="hidden" name="post" value={postId} />}
      <fieldset className="reasons">
        <legend className="mono mute">Report</legend>
        {REPORT_REASONS.map((r, i) => (
          <label key={r} className="mono"><input type="radio" name="reason" value={r} defaultChecked={i === 0} />{r}</label>
        ))}
      </fieldset>
      <input className="input" name="note" maxLength={500} placeholder="Note (optional)" autoComplete="off" />
      <div className="actions"><button className="btn solid small" type="submit">Send report</button><Link className="mono mute" href={back}>Cancel</Link></div>
    </form>
  );
}

/** Written by someone else since you last opened the thread. */
const isFresh = (p: Post, me: User, since: number | null) => !!since && !p.deleted && p.user_id !== me.id && new Date(p.created_at).getTime() > since;

function count(kids: Map<number, Post[]>, id: number): number {
  return (kids.get(id) ?? []).reduce((n, c) => n + 1 + count(kids, c.id), 0);
}

function Comment({ post, kids, depth, me, threadId, locked, since, mode, blocked }: {
  post: Post; kids: Map<number, Post[]>; depth: number; me: User; threadId: number; locked: boolean; since: number | null; mode: Mode; blocked: Set<number>;
}) {
  const fresh = isFresh(post, me, since);
  const children = kids.get(post.id) ?? [];
  const own = post.user_id === me.id;
  const here = `/forum/t/${threadId}`;
  const anchor = `${here}#p${post.id}`;
  const editing = mode.edit === `p${post.id}` && own && !post.deleted;
  const reporting = mode.report === `p${post.id}` && !own && !post.deleted;
  const nested = children.length > 0 && (
    <div className={depth < MAX_DEPTH ? 'kids' : 'kids flat'}>
      {children.map((c) => <Comment key={c.id} post={c} kids={kids} depth={depth + 1} me={me} threadId={threadId} locked={locked} since={since} mode={mode} blocked={blocked} />)}
    </div>
  );

  if (post.deleted || (post.user_id && blocked.has(post.user_id))) {
    return (
      <div className="comment" id={`p${post.id}`}>
        <p className="gone mono">{post.deleted ? 'Deleted' : 'Hidden: a member you blocked'}</p>
        {nested}
      </div>
    );
  }

  const hidden = count(kids, post.id);
  return (
    <div className={`comment${fresh ? ' fresh' : ''}`} id={`p${post.id}`}>
      <input type="checkbox" className="fold" id={`f${post.id}`} aria-label="Collapse" />
      <header className="mono">
        <Avatar name={post.author} size={22} />
        <Author name={post.author} />
        <a className="when" href={`#p${post.id}`}>{ago(post.created_at)}</a>
        {post.edited_at && <span className="mute">edited</span>}
        {fresh && <span className="pill on">New</span>}
        <span className="folded mute">{hidden ? `+${hidden + 1}` : 'hidden'}</span>
        <label className="fold-btn" htmlFor={`f${post.id}`} title="Collapse / expand"><span className="i-min"><Minus /></span><span className="i-plus"><Plus /></span></label>
      </header>
      {editing ? (
        <form action={editPost} className="stack inline-form">
          <input type="hidden" name="id" value={post.id} />
          <label className="sr" htmlFor={`e${post.id}`}>Edit comment</label>
          <Writer id={`e${post.id}`} rows={4} maxLength={LIMITS.comment} defaultValue={post.body} draft={false} autoFocus>
            <Link className="mono mute" href={anchor}>Cancel</Link>
            <button className="btn solid small" type="submit">Save</button>
          </Writer>
        </form>
      ) : <RichText text={post.body} />}
      {!editing && (
        <div className="acts">
          <LikeButton target="post" id={post.id} count={post.props} mine={post.mine} back={anchor} />
          {!locked && (
            <details className="pop">
              <summary className="act"><Reply /><span>Reply</span></summary>
              <form action={reply} className="stack inline-form">
                <input type="hidden" name="thread" value={threadId} />
                <input type="hidden" name="parent" value={post.id} />
                <label className="sr" htmlFor={`r${post.id}`}>Reply to {post.author ?? 'comment'}</label>
                <Writer id={`r${post.id}`} rows={2} maxLength={LIMITS.comment} placeholder={`Reply to ${post.author ?? 'comment'}`}>
                  <button className="btn solid small" type="submit">Reply</button>
                </Writer>
              </form>
            </details>
          )}
          {!locked && <QuoteButton target={`p${post.id}`} author={post.author} />}
          <Menu label="More">
            {own && <Link href={`${here}?edit=p${post.id}#p${post.id}`}>Edit</Link>}
            {!own && <Link href={`${here}?report=p${post.id}#p${post.id}`}>Report</Link>}
            {(own || me.is_admin) && (
              <form action={deletePost}><input type="hidden" name="id" value={post.id} /><button type="submit" className="danger">Delete</button></form>
            )}
          </Menu>
        </div>
      )}
      {reporting && <ReportForm threadId={threadId} postId={post.id} back={anchor} />}
      {nested}
    </div>
  );
}

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string } & Mode> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  const mode: Mode = { edit: sp.edit, report: sp.report, move: sp.move };
  if (!Number.isInteger(id)) notFound();

  const thread = await one<Thread>(
    `SELECT t.*, u.username AS author,
            (SELECT count(*)::int FROM props WHERE target = 'thread' AND target_id = t.id) AS props,
            EXISTS (SELECT 1 FROM props WHERE target = 'thread' AND target_id = t.id AND member_id = $2) AS mine,
            COALESCE((SELECT following FROM thread_follows WHERE thread_id = t.id AND member_id = $2), false) AS following,
            EXISTS (SELECT 1 FROM thread_saves WHERE thread_id = t.id AND member_id = $2) AS saved
       FROM threads t LEFT JOIN members u ON u.id = t.user_id
      WHERE t.id = $1 AND ${LIVE}`,
    [id, me.id],
  );
  if (!thread) notFound();
  const posts = await q<Post>(
    `SELECT p.id, p.parent_id, p.body, p.user_id, u.username AS author, p.created_at, p.edited_at, p.deleted,
            (SELECT count(*)::int FROM props WHERE target = 'post' AND target_id = p.id) AS props,
            EXISTS (SELECT 1 FROM props WHERE target = 'post' AND target_id = p.id AND member_id = $2) AS mine
       FROM posts p LEFT JOIN members u ON u.id = p.user_id
      WHERE p.thread_id = $1 ORDER BY p.created_at LIMIT 1000`,
    [id, me.id],
  );
  const blocked = new Set((await q<{ id: number }>('SELECT blocked_id AS id FROM blocks WHERE blocker_id = $1', [me.id])).map((b) => b.id));
  // When you last had this thread open, so comments since then can be marked (first visit: nothing is marked).
  const seen = await one<{ read_at: string }>('SELECT read_at FROM thread_reads WHERE member_id = $1 AND thread_id = $2', [me.id, id]);
  const since = seen ? new Date(seen.read_at).getTime() : null;
  await q(
    `INSERT INTO thread_reads (member_id, thread_id, read_at) VALUES ($1, $2, now())
     ON CONFLICT (member_id, thread_id) DO UPDATE SET read_at = now()`,
    [me.id, id],
  );

  // Build the comment tree. Deleted comments only show if something hangs off them.
  const ids = new Set(posts.map((p) => p.id));
  const kids = new Map<number, Post[]>();
  const top: Post[] = [];
  for (const p of posts) {
    if (p.parent_id && ids.has(p.parent_id)) kids.set(p.parent_id, [...(kids.get(p.parent_id) ?? []), p]);
    else top.push(p);
  }
  const hasLive = (p: Post): boolean => !p.deleted || (kids.get(p.id) ?? []).some(hasLive);
  for (const [k, list] of kids) kids.set(k, list.filter(hasLive));
  const roots = top.filter(hasLive);

  const board = boardBySlug(thread.board);
  const sub = subBySlug(thread.board, thread.topic);
  const place = sub ? `${thread.board}/${sub.slug}` : undefined;
  const market = !!board?.market;
  const fresh = posts.filter((p) => isFresh(p, me, since));
  const own = thread.user_id === me.id;
  const locked = thread.locked && !me.is_admin;
  const here = `/forum/t/${thread.id}`;
  const editing = mode.edit === 'thread' && own;
  const sold = thread.status === 'sold';

  // Market: how it sells, plus whatever this member needs to see (offers, bids, their deal).
  let l: Listing | null = market ? await getListing(thread.id) : null;
  if (l?.mode === 'auction' && !l.settled && l.ends_at && new Date(l.ends_at).getTime() <= Date.now()) {
    await settleAuctions(true);
    l = await getListing(thread.id);
  }
  const [rep, myRep, bids, offers, myOffer, myDeal] = l
    ? await Promise.all([
        l.seller_id ? reputation(l.seller_id) : Promise.resolve({ sold: 0, bought: 0, good: 0, bad: 0, unpaid: 0 }),
        !own && l.min_deals > 0 ? reputation(me.id) : Promise.resolve(null),
        l.mode === 'auction' ? bidsFor(thread.id) : Promise.resolve([]),
        own ? q<PendingOffer>(
          `SELECT o.id, m.username AS buyer, o.amount_cents, o.quantity, o.method, o.note, o.created_at FROM offers o LEFT JOIN members m ON m.id = o.buyer_id
            WHERE o.listing_id = $1 AND o.kind = 'offer' AND o.status = 'pending' ORDER BY o.created_at`, [thread.id]) : Promise.resolve([]),
        !own ? one<PendingOffer>(
          `SELECT o.id, NULL AS buyer, o.amount_cents, o.quantity, o.method, o.note, o.created_at FROM offers o
            WHERE o.listing_id = $1 AND o.buyer_id = $2 AND o.kind = 'offer' AND o.status = 'pending' ORDER BY o.created_at DESC LIMIT 1`, [thread.id, me.id]) : Promise.resolve(null),
        !own ? one<{ id: number }>(`SELECT id FROM deals WHERE thread_id = $1 AND buyer_id = $2 AND status NOT IN ('complete', 'cancelled') ORDER BY id DESC LIMIT 1`, [thread.id, me.id]) : Promise.resolve(null),
      ])
    : [null, null, [], [], null, null];

  // Zines with sample pages read like a zine; the pictures leave the text.
  const pageIds = l && thread.topic === 'zines' ? mediaIn(thread.body) : [];
  let zine: ZinePage[] = [];
  if (pageIds.length >= 2) {
    const dims = await q<{ id: string; width: number; height: number }>('SELECT id, width, height FROM media WHERE id = ANY($1::text[])', [pageIds]);
    const by = new Map(dims.map((d) => [d.id, d]));
    zine = pageIds.filter((i) => by.has(i)).map((i) => ({ src: mediaUrl(i), w: by.get(i)!.width, h: by.get(i)!.height }));
  }
  const text = zine.length >= 2 ? thread.body.split('\n').filter((line) => !MEDIA_LINE.test(line.trim())).join('\n') : thread.body;
  const cents = (c: number | null) => (c == null ? '' : (c / 100).toFixed(c % 100 ? 2 : 0));

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">Forum</Link><span>/</span>
        <Link href={`/forum/${thread.board}`}>{board?.name ?? thread.board}</Link>
        {sub && <><span>/</span><Link href={`/forum/${thread.board}/${sub.slug}`}>{sub.name}</Link></>}
      </nav>

      <header className="thread-head">
        {(thread.pinned || thread.locked || thread.expires_at) && (
          <div className="flags mono">
            {thread.pinned && <span className="pill on">Pinned</span>}
            {thread.locked && <span className="pill">Locked</span>}
            {thread.expires_at && <span className="pill vanish" title={new Date(thread.expires_at).toUTCString()}><Hourglass />Vanishes in {left(thread.expires_at)}</span>}
          </div>
        )}
        <h1 className="title thread-title">{thread.title}</h1>
        <div className="thread-meta mono">
          <Avatar name={thread.author} size={26} />
          <Author name={thread.author} />
          <span>{ago(thread.created_at)}</span>
          {thread.edited_at && <span className="mute">edited</span>}
          {readingMinutes(thread.body) >= 3 && <span className="mute">{readingMinutes(thread.body)} min read</span>}
        </div>
      </header>

      <Notice error={sp.error} ok={sp.ok} />

      <article className="op" id="op">
        {l && l.mode === 'auction' && auctionOpen(l) && <RefreshEvery seconds={15} />}
        {l && !editing && (
          <DealBox
            thread={{ id: thread.id, title: thread.title, author: thread.author, user_id: thread.user_id }}
            l={l} status={thread.status} me={me} rep={rep!} myRep={myRep} bids={bids} offers={offers} myOffer={myOffer} myDealId={myDeal?.id ?? null}
          />
        )}
        {market && !l && (
          <div className={`listing-bar${sold ? ' sold' : ''}`}>
            <span className="l-price">{thread.price || 'No price'}</span>
            <span className="pill mono">{sold ? 'Sold' : 'Available'}</span>
            <span className="listing-actions">
              {!own && thread.author && <Link className="btn solid small" href={`/messages/${encodeURIComponent(thread.author)}?about=${thread.id}`}>Message</Link>}
              {(own || me.is_admin) && (
                <form action={toggleSold}><input type="hidden" name="id" value={thread.id} /><button className="btn small" type="submit">{sold ? 'Relist' : 'Mark sold'}</button></form>
              )}
            </span>
          </div>
        )}
        {zine.length >= 2 && !editing && <ZineViewer pages={zine} title={thread.title} />}

        {editing && l ? (
          <ListingForm
            action={updateListing} id={thread.id} cancelHref={here} submit="Save listing"
            frozen={l.mode === 'auction' && (bids.length > 0 || l.settled)}
            defaults={{
              place, title: thread.title, body: thread.body, mode: l.mode === 'wanted' ? 'fixed' : l.mode, currency: l.currency,
              price: l.mode === 'auction' ? '' : cents(l.price_cents), start: l.mode === 'auction' ? cents(l.price_cents) : '',
              quantity: l.quantity, accept_offers: l.accept_offers, ships: l.ships, ship_cost: cents(l.ship_cents), ship_note: l.ship_note ?? '',
              meetup: l.meetup, meetup_area: l.meetup_area ?? '', trades: l.trades, increment: cents(l.increment_cents), min_deals: l.min_deals,
              expires: thread.expires_at,
            }}
          />
        ) : editing ? (
          <form action={editThread} className="stack inline-form edit-thread">
            <input type="hidden" name="id" value={thread.id} />
            <div className="field-row">
              <div className="field"><label className="mono" htmlFor="ep">Section</label><PlacePicker id="ep" scope={market ? 'market' : 'forum'} defaultValue={place} /></div>
              {market && <div className="field"><label className="mono" htmlFor="epr">Price</label><input className="input" id="epr" name="price" maxLength={LIMITS.price} defaultValue={thread.price ?? ''} /></div>}
            </div>
            <div className="field"><label className="mono" htmlFor="et">Title</label><input className="input" id="et" name="title" maxLength={LIMITS.title} required defaultValue={thread.title} /></div>
            <div className="field"><label className="mono" htmlFor="eb">Post</label><Writer id="eb" rows={10} maxLength={LIMITS.body} defaultValue={thread.body} draft={false} /></div>
            <div className="field"><label className="mono" htmlFor="ev">Vanish</label><VanishPicker id="ev" editing current={thread.expires_at} /></div>
            <div className="actions"><button className="btn solid small" type="submit">Save</button><Link className="mono mute" href={here}>Cancel</Link></div>
          </form>
        ) : thread.user_id && blocked.has(thread.user_id) ? (
          <details className="blocked-post"><summary className="mono mute">Posted by a member you blocked. Show anyway</summary><RichText text={text} /></details>
        ) : <RichText text={text} />}

        {!editing && (
          <div className="acts">
            <LikeButton target="thread" id={thread.id} count={thread.props} mine={thread.mine} back={here} />
            {!locked && <QuoteButton target="op" author={thread.author} />}
            <form action={toggleFollow}>
              <input type="hidden" name="id" value={thread.id} />
              <button className={`act${thread.following ? ' on' : ''}`} type="submit" aria-pressed={thread.following} title="Alerts for new comments">
                <Bell on={thread.following} /><span>{thread.following ? 'Following' : 'Follow'}</span>
              </button>
            </form>
            <form action={toggleSave}>
              <input type="hidden" name="id" value={thread.id} />
              <input type="hidden" name="back" value={here} />
              <button className={`act${thread.saved ? ' on' : ''}`} type="submit" aria-pressed={thread.saved}>
                <Bookmark on={thread.saved} /><span>{thread.saved ? 'Saved' : 'Save'}</span>
              </button>
            </form>
            <Menu label="More">
              {own && <Link href={`${here}?edit=thread`}>Edit</Link>}
              {!own && <Link href={`${here}?report=thread`}>Report</Link>}
              {me.is_admin && (
                <>
                  <form action={setThreadFlag}><input type="hidden" name="id" value={thread.id} /><input type="hidden" name="flag" value="pinned" /><button type="submit">{thread.pinned ? 'Unpin' : 'Pin'}</button></form>
                  <form action={setThreadFlag}><input type="hidden" name="id" value={thread.id} /><input type="hidden" name="flag" value="locked" /><button type="submit">{thread.locked ? 'Unlock' : 'Lock'}</button></form>
                  <Link href={`${here}?move=1`}>Move</Link>
                </>
              )}
              {(own || me.is_admin) && (
                <form action={deleteThread}><input type="hidden" name="id" value={thread.id} /><button type="submit" className="danger">Delete thread</button></form>
              )}
            </Menu>
          </div>
        )}
        {mode.report === 'thread' && !own && <ReportForm threadId={thread.id} back={here} />}
        {mode.move && me.is_admin && (
          <form action={moveThread} className="inline-form move-inline">
            <input type="hidden" name="id" value={thread.id} />
            <label className="mono mute" htmlFor="mv">Move to</label>
            <PlacePicker id="mv" scope="all" defaultValue={place} />
            <button className="btn solid small" type="submit">Move</button>
            <Link className="mono mute" href={here}>Cancel</Link>
          </form>
        )}
      </article>

      <Pulse thread={thread.id} since={new Date().toISOString()} />
      {readingMinutes(thread.body) >= 3 && <ReadingBar target="op" />}
      <section className="comments" aria-label="Comments">
        <div className="comments-head mono">
          <span className="br">{thread.reply_count} {thread.reply_count === 1 ? 'comment' : 'comments'}</span>
          {fresh.length > 0 && <a className="jump" href={`#p${fresh[0].id}`}>{fresh.length} new &darr;</a>}
        </div>
        {locked ? (
          <p className="notice mono">Locked.</p>
        ) : (
          <form action={reply} className="composer" id="reply">
            <input type="hidden" name="thread" value={thread.id} />
            <label className="sr" htmlFor="body">Comment</label>
            <Writer id="body" rows={2} maxLength={LIMITS.comment} placeholder="Write a comment">
              <button className="btn solid small" type="submit">Comment</button>
            </Writer>
          </form>
        )}
        {roots.length ? (
          roots.map((p) => <Comment key={p.id} post={p} kids={kids} depth={1} me={me} threadId={thread.id} locked={locked} since={since} mode={mode} blocked={blocked} />)
        ) : (
          <p className="empty mono">No comments.</p>
        )}
      </section>
    </>
  );
}
