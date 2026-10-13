import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser, type User } from '@/lib/auth';
import { ago, left } from '@/lib/format';
import { money } from '@/lib/money';
import { mediaUrl } from '@/lib/media-token';
import { reputation, settleAuctions, STEPS, TRACK, CANCEL_REASONS, canCancel, type DealStatus, type Method } from '@/lib/market';
import { dealStep, cancelDeal, secondChance, leaveFeedback, respondOffer, withdrawOffer, setStock } from '@/app/market-actions';
import { repLine } from '@/components/DealBox';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';
import { SortTabs } from '@/components/ForumNav';
import { Reveal } from '@/components/Live';

export const metadata = { title: 'Market' };

type Deal = {
  id: number; thread_id: number | null; live: boolean; has_open: boolean; title: string; cover: string | null; seller_id: number | null; buyer_id: number | null;
  seller: string | null; buyer: string | null; source: string; amount_cents: number | null; ship_cents: number | null; currency: string;
  quantity: number; method: Method; note: string | null; status: DealStatus; created_at: string; updated_at: string;
  cancelled_by: number | null; cancel_reason: string | null;
  buyer_rating: string | null; buyer_note: string | null; seller_rating: string | null; seller_note: string | null;
};
type Mine = {
  id: number; title: string; price: string | null; status: string | null; cover: string | null; mode: string; quantity: number; sold_count: number;
  currency: string; ends_at: string | null; settled: boolean; offers: number; bids: number; format: string; review: string | null; review_note: string | null;
};
type Incoming = { id: number; amount_cents: number | null; quantity: number; method: string | null; note: string | null; created_at: string; buyer: string | null; thread_id: number; title: string; cover: string | null; currency: string };
type Outgoing = { id: number; kind: 'offer' | 'bid'; amount_cents: number | null; quantity: number; status: string; created_at: string; thread_id: number; title: string; cover: string | null; currency: string; ends_at: string | null; settled: boolean; top: number | null };
type Tab = 'buying' | 'selling' | 'history';

const COVER = `substring(t.body from '\\[img:([A-Za-z0-9_-]{16})\\]') AS cover`;

const METHOD = { ship: 'Shipping', meetup: 'Meetup', digital: 'Digital' } as const;
const REASON: Record<string, string> = { unpaid: "buyer didn't pay", unavailable: 'no longer available', changed: 'changed their mind', other: 'other' };
const MY_REASON: Record<string, string> = { ...REASON, changed: 'changed your mind' };
const myTurn = (d: Deal, me: User) => {
  const step = STEPS[d.method][d.status];
  return !!step && (step.who === 'buyer' ? d.buyer_id : d.seller_id) === me.id;
};

/** The item's photo, small, as on an order. */
function Thumb({ cover, href }: { cover: string | null; href: string | null }) {
  const img = cover
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={`${mediaUrl(cover)}?w=240&sq=1`} alt="" loading="lazy" decoding="async" />
    : <span className="cover-blank" />;
  return href ? <Link className="inv-cover" href={href} tabIndex={-1} aria-hidden="true">{img}</Link> : <span className="inv-cover" aria-hidden="true">{img}</span>;
}

function DealCard({ d, me }: { d: Deal; me: User }) {
  const role = d.seller_id === me.id ? 'seller' : 'buyer';
  const other = role === 'seller' ? d.buyer : d.seller;
  const step = STEPS[d.method][d.status];
  const turn = myTurn(d, me);
  const track = TRACK[d.method];
  const at = track.findIndex((s) => s.status === d.status);
  const total = d.amount_cents != null ? d.amount_cents + (d.ship_cents ?? 0) : null;
  const myRating = role === 'buyer' ? d.buyer_rating : d.seller_rating;
  const theirRating = role === 'buyer' ? d.seller_rating : d.buyer_rating;
  const theirNote = role === 'buyer' ? d.seller_note : d.buyer_note;
  const href = d.live ? `/forum/t/${d.thread_id}` : null;
  return (
    <li id={`d${d.id}`} className={`dealcard${turn ? ' turn' : ''}${d.status === 'cancelled' ? ' cancelled' : ''}`}>
      <div className="dc-top">
        <Thumb cover={d.cover} href={href} />
        <div className="dc-main">
          <div className="dc-head">
            {href ? <Link className="dc-title" href={href}>{d.title}</Link> : <span className="dc-title">{d.title}</span>}
            <span className="dc-amount">{total != null ? money(total, d.currency) : 'Trade'}</span>
          </div>
          <p className="dc-meta mono">
            <span className="mute">{role === 'seller' ? 'Sold to' : 'Bought from'}</span>
            <Avatar name={other} size={18} />
            {other ? <Link href={`/u/${encodeURIComponent(other)}`}>{other}</Link> : 'gone'}
            <span className="mute">/ {d.quantity > 1 ? `${d.quantity}x / ` : ''}{METHOD[d.method]}{d.ship_cents ? ` (+${money(d.ship_cents, d.currency)})` : ''} / {d.source === 'auction' ? 'auction' : d.source === 'offer' ? 'offer' : 'bought'} {ago(d.created_at)}</span>
          </p>
        </div>
      </div>
      {d.note && <p className="dc-note">{d.note}</p>}

      {d.status === 'cancelled' ? (
        <p className="dc-state mono">Cancelled by {d.cancelled_by === me.id ? 'you' : other ?? 'them'}{d.cancel_reason ? `: ${(d.cancelled_by === me.id ? MY_REASON : REASON)[d.cancel_reason] ?? d.cancel_reason}` : ''}</p>
      ) : (
        <ol className="dc-track mono" aria-label="Progress">
          {track.map((s, i) => <li key={s.status} className={i < at || d.status === 'complete' ? 'done' : i === at ? 'now' : ''}>{s.label}</li>)}
        </ol>
      )}

      <div className="dc-acts">
        {turn && step && (
          <form action={dealStep}><input type="hidden" name="id" value={d.id} /><button className="btn solid small" type="submit">{step.label}</button></form>
        )}
        {!turn && step && <span className="mono mute">Waiting on {other ?? 'them'}</span>}
        {other && d.status !== 'complete' && d.status !== 'cancelled' && <Link className="btn small" href={`/messages/${encodeURIComponent(other)}`}>Message</Link>}
        {canCancel(d.status, role) && (
          <details className="menu">
            <summary className="act">Cancel</summary>
            <form action={cancelDeal} className="menu-panel cancel-form">
              <input type="hidden" name="id" value={d.id} />
              {CANCEL_REASONS[role].map((r, i) => (
                <label key={r.id}><input type="radio" name="reason" value={r.id} defaultChecked={i === 0} />{r.label}</label>
              ))}
              <button type="submit" className="danger">Cancel deal</button>
            </form>
          </details>
        )}
        {role === 'seller' && d.source === 'auction' && d.status === 'cancelled' && d.cancel_reason === 'unpaid' && !d.has_open && d.live && (
          <form action={secondChance}><input type="hidden" name="id" value={d.id} /><button className="btn small" type="submit">Offer to next bidder</button></form>
        )}
      </div>

      {d.status === 'complete' && (
        <div className="dc-feedback">
          {myRating ? (
            <span className="mono mute">You left {myRating} feedback.</span>
          ) : (
            <form action={leaveFeedback} className="fb-form">
              <input type="hidden" name="id" value={d.id} />
              <span className="mono mute">How was it?</span>
              <label className="mono"><input type="radio" name="rating" value="good" defaultChecked /> Good</label>
              <label className="mono"><input type="radio" name="rating" value="bad" /> Bad</label>
              <input className="input" name="note" maxLength={140} placeholder="A few words (optional)" autoComplete="off" />
              <button className="btn small" type="submit">Leave feedback</button>
            </form>
          )}
          {theirRating && <span className="mono mute">{other ?? 'They'} left {theirRating}{theirNote ? `: "${theirNote}"` : ''}</span>}
        </div>
      )}
    </li>
  );
}

function Deals({ title, deals, me, note }: { title: string; deals: Deal[]; me: User; note?: string }) {
  if (!deals.length) return null;
  return (
    <section className="mk-sec">
      <div className="sec-head mono"><span className="br">{title}</span>{note && <span>{note}</span>}</div>
      <ul className="dealcards">{deals.map((d) => <DealCard key={d.id} d={d} me={me} />)}</ul>
    </section>
  );
}

export default async function Market({ searchParams }: { searchParams: Promise<{ tab?: string; deal?: string; ok?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  await settleAuctions();

  const [deals, mine, incoming, outgoing, rep] = await Promise.all([
    q<Deal>(
      `SELECT d.*, s.username AS seller, b.username AS buyer, ${COVER},
              (t.id IS NOT NULL AND NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now())) AS live,
              EXISTS (SELECT 1 FROM deals x WHERE x.thread_id = d.thread_id AND x.status <> 'cancelled') AS has_open
         FROM deals d
         LEFT JOIN members s ON s.id = d.seller_id
         LEFT JOIN members b ON b.id = d.buyer_id
         LEFT JOIN threads t ON t.id = d.thread_id
        WHERE d.seller_id = $1 OR d.buyer_id = $1
        ORDER BY d.updated_at DESC LIMIT 300`,
      [me.id],
    ),
    q<Mine>(
      `SELECT t.id, t.title, t.price, t.status, ${COVER}, t.review, t.review_note,
              l.mode, l.quantity, l.sold_count, l.currency, l.ends_at, l.settled, l.format,
              (SELECT count(*) FROM offers WHERE listing_id = t.id AND kind = 'offer' AND status = 'pending')::int AS offers,
              (SELECT count(*) FROM offers WHERE listing_id = t.id AND kind = 'bid')::int AS bids
         FROM listings l JOIN threads t ON t.id = l.thread_id
        WHERE l.seller_id = $1 AND NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now())
        ORDER BY t.created_at DESC`,
      [me.id],
    ),
    q<Incoming>(
      `SELECT o.id, o.amount_cents, o.quantity, o.method, o.note, o.created_at, m.username AS buyer, t.id AS thread_id, t.title, ${COVER}, l.currency
         FROM offers o JOIN listings l ON l.thread_id = o.listing_id JOIN threads t ON t.id = o.listing_id LEFT JOIN members m ON m.id = o.buyer_id
        WHERE l.seller_id = $1 AND o.kind = 'offer' AND o.status = 'pending' AND NOT t.deleted
        ORDER BY o.created_at`,
      [me.id],
    ),
    q<Outgoing>(
      `SELECT o.id, o.kind, o.amount_cents, o.quantity, o.status, o.created_at, t.id AS thread_id, t.title, ${COVER}, l.currency, l.ends_at, l.settled,
              (SELECT max(x.amount_cents) FROM offers x WHERE x.listing_id = o.listing_id AND x.kind = 'bid' AND x.status IN ('active', 'won')) AS top
         FROM offers o JOIN listings l ON l.thread_id = o.listing_id JOIN threads t ON t.id = o.listing_id
        WHERE o.buyer_id = $1 AND NOT t.deleted
        ORDER BY o.amount_cents DESC NULLS LAST, o.created_at DESC LIMIT 200`,
      [me.id],
    ),
    reputation(me.id),
  ]);

  const active = deals.filter((d) => d.status !== 'complete' && d.status !== 'cancelled');
  const done = deals.filter((d) => d.status === 'complete' || d.status === 'cancelled');
  const buying = active.filter((d) => d.buyer_id === me.id);
  const selling = active.filter((d) => d.seller_id === me.id);
  const buyDue = buying.filter((d) => myTurn(d, me));
  const sellDue = selling.filter((d) => myTurn(d, me));
  // One line per auction (your best bid); offers newest first. Settled ones drop to history.
  const seen = new Set<number>();
  const mineOut = outgoing.filter((o) => o.kind === 'offer' || (!seen.has(o.thread_id) && seen.add(o.thread_id)))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const liveOut = mineOut.filter((o) => (o.kind === 'offer' ? o.status === 'pending' : !o.settled));
  const totals = (role: 'seller' | 'buyer') => {
    const sums = new Map<string, number>();
    for (const d of deals) if (d.status === 'complete' && (role === 'seller' ? d.seller_id : d.buyer_id) === me.id && d.amount_cents != null) {
      sums.set(d.currency, (sums.get(d.currency) ?? 0) + d.amount_cents + (d.ship_cents ?? 0));
    }
    return [...sums].map(([c, v]) => money(v, c)).join(' + ') || money(0);
  };

  // Which tab: the one holding a deal you were sent to, the one you asked for, or wherever something needs you.
  const target = sp.deal ? deals.find((d) => d.id === Number(sp.deal)) : undefined;
  const asked = sp.tab === 'listings' ? 'selling' : sp.tab === 'offers' ? 'buying' : sp.tab;
  const tab: Tab = target
    ? (target.status === 'complete' || target.status === 'cancelled' ? 'history' : target.seller_id === me.id ? 'selling' : 'buying')
    : asked === 'buying' || asked === 'selling' || asked === 'history' ? asked
    : buyDue.length ? 'buying' : sellDue.length || incoming.length ? 'selling' : buying.length || liveOut.length ? 'buying' : 'selling';
  const sellNeeds = sellDue.length + incoming.length;
  const TABS = [
    { id: 'buying', name: <>Buying{buyDue.length > 0 && <span className="count">{buyDue.length}</span>}</>, href: '/market?tab=buying' },
    { id: 'selling', name: <>Selling{sellNeeds > 0 && <span className="count">{sellNeeds}</span>}</>, href: '/market?tab=selling' },
    { id: 'history', name: 'History', href: '/market?tab=history' },
  ];

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb"><Link href="/forum/market">Market</Link><span>/</span><span>Yours</span></nav>
      <div className="page-head">
        <div>
          <h1 className="title">Your market</h1>
          <p className="mono mute stat-line">{[repLine(rep), rep.sold ? `sold ${totals('seller')}` : '', rep.bought ? `bought ${totals('buyer')}` : ''].filter(Boolean).join(' / ')}</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/forum/market">Browse</Link>
          <Link className="btn solid" href="/forum/market/new">Sell</Link>
        </div>
      </div>
      <Notice ok={sp.ok} error={sp.error} />
      <SortTabs label="Your market" items={TABS} current={tab} />
      {target && <Reveal id={`d${target.id}`} />}

      {tab === 'buying' && (
        <>
          <Deals title="Needs you" deals={buyDue} me={me} />
          <Deals title="On the way" deals={buying.filter((d) => !myTurn(d, me))} me={me} note="Waiting on the seller" />
          {liveOut.length > 0 && (
            <section className="mk-sec">
              <div className="sec-head mono"><span className="br">Offers & bids</span></div>
              <ul className="mk-list">
                {liveOut.map((o) => {
                  const leading = o.kind === 'bid' && o.amount_cents === o.top;
                  const state = o.kind === 'bid' ? (leading ? 'Leading' : 'Outbid') : 'Pending';
                  return (
                    <li key={o.id} className="mk-row">
                      <Thumb cover={o.cover} href={`/forum/t/${o.thread_id}`} />
                      <span className="mk-main">
                        <Link className="mk-title" href={`/forum/t/${o.thread_id}`}>{o.title}</Link>
                        <span className="mono mute">
                          {o.kind === 'bid' ? 'Your bid' : 'Your offer'} {o.amount_cents != null ? money(o.amount_cents, o.currency) : '(trade)'}
                          {o.kind === 'bid' && o.ends_at ? ` / ends in ${left(o.ends_at)}` : ''} / {ago(o.created_at)}
                        </span>
                      </span>
                      <span className={`pill mono${state === 'Leading' ? ' on' : state === 'Outbid' ? ' bad' : ''}`}>{state}</span>
                      {o.kind === 'offer' && (
                        <form action={withdrawOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="back" value="/market?tab=buying" /><button className="linkbtn mono mute" type="submit">Withdraw</button></form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {!buying.length && !liveOut.length && <p className="empty mono mk-empty">Nothing on the way. <Link href="/forum/market">Browse the market &rarr;</Link></p>}
        </>
      )}

      {tab === 'selling' && (
        <>
          {incoming.length > 0 && (
            <section className="mk-sec">
              <div className="sec-head mono"><span className="br">Offers to answer</span></div>
              <ul className="mk-list">
                {incoming.map((o) => (
                  <li key={o.id} className="mk-row turn">
                    <Thumb cover={o.cover} href={`/forum/t/${o.thread_id}`} />
                    <span className="mk-main">
                      <Link className="mk-title" href={`/forum/t/${o.thread_id}`}>{o.title}</Link>
                      <span className="mono mute">{o.buyer ?? 'gone'} offers <b className="bone">{o.amount_cents != null ? money(o.amount_cents, o.currency) : 'a trade'}</b>{o.quantity > 1 ? ` for ${o.quantity}` : ''}{o.method ? ` / ${METHOD[o.method as Method]}` : ''} / {ago(o.created_at)}</span>
                      {o.note && <span className="dl-note">{o.note}</span>}
                    </span>
                    <span className="dl-acts">
                      <form action={respondOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="do" value="accept" /><input type="hidden" name="back" value="/market?tab=selling" /><button className="btn small solid" type="submit">Accept</button></form>
                      <form action={respondOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="do" value="decline" /><input type="hidden" name="back" value="/market?tab=selling" /><button className="btn small" type="submit">Decline</button></form>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Deals title="Needs you" deals={sellDue} me={me} />
          <Deals title="Sold, in progress" deals={selling.filter((d) => !myTurn(d, me))} me={me} note="Waiting on the buyer" />
          <section className="mk-sec">
            <div className="sec-head mono"><span className="br">Your listings</span><Link href="/forum/market/new">Sell something &rarr;</Link></div>
            {mine.length ? (
              <ul className="mk-list inv">
                {mine.map((m) => {
                  const left_ = Math.max(0, m.quantity - m.sold_count);
                  return (
                    <li key={m.id} className="mk-row">
                      <Thumb cover={m.cover} href={`/forum/t/${m.id}`} />
                      <span className="mk-main">
                        <Link className="mk-title" href={`/forum/t/${m.id}`}>{m.title}</Link>
                        <span className="mono mute">
                          {m.review === 'pending' ? <span className="pill">In review</span>
                            : m.review === 'rejected' ? <span className="pill bad" title={m.review_note ?? undefined}>Not approved</span> : null}
                          {m.review ? ' ' : ''}
                          {m.format === 'digital' ? `Read here / ${m.sold_count} ${m.sold_count === 1 ? 'copy' : 'copies'}`
                            : m.mode === 'auction' ? (m.settled ? (m.sold_count ? 'Auction sold' : 'Auction ended') : `Auction / ${m.bids} ${m.bids === 1 ? 'bid' : 'bids'} / ${m.ends_at ? `${left(m.ends_at)} left` : ''}`)
                            : m.mode === 'wanted' ? 'Wanted' : `${m.sold_count} sold`}
                          {m.offers ? ` / ${m.offers} ${m.offers === 1 ? 'offer' : 'offers'}` : ''}
                          {m.status === 'closed' ? ' / closed' : ''}
                        </span>
                      </span>
                      <span className="inv-price">{m.price}</span>
                      {(m.mode === 'fixed' || m.mode === 'offers') && m.format !== 'digital' && (
                        <form action={setStock} className="stock-form mono">
                          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value="/market?tab=selling" />
                          <label>Left <input className="input small-num" type="number" inputMode="numeric" name="left" min={0} max={999} defaultValue={left_} /></label>
                          <button className="linkbtn mono" type="submit">Save</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="empty mono mk-empty">Nothing for sale yet. <Link href="/forum/market/new">Sell something &rarr;</Link></p>}
          </section>
        </>
      )}

      {tab === 'history' && (
        done.length ? (
          <section className="mk-sec"><ul className="dealcards">{done.map((d) => <DealCard key={d.id} d={d} me={me} />)}</ul></section>
        ) : <p className="empty mono mk-empty">No finished deals yet.</p>
      )}
    </>
  );
}
