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

export const metadata = { title: 'Market' };

type Deal = {
  id: number; thread_id: number | null; live: boolean; has_open: boolean; title: string; seller_id: number | null; buyer_id: number | null;
  seller: string | null; buyer: string | null; source: string; amount_cents: number | null; ship_cents: number | null; currency: string;
  quantity: number; method: Method; note: string | null; status: DealStatus; created_at: string; updated_at: string;
  cancelled_by: number | null; cancel_reason: string | null;
  buyer_rating: string | null; buyer_note: string | null; seller_rating: string | null; seller_note: string | null;
};
type Mine = { id: number; title: string; price: string | null; status: string | null; cover: string | null; mode: string; quantity: number; sold_count: number; currency: string; ends_at: string | null; settled: boolean; offers: number; bids: number };
type Incoming = { id: number; amount_cents: number | null; quantity: number; method: string | null; note: string | null; created_at: string; buyer: string | null; thread_id: number; title: string; currency: string };
type Outgoing = { id: number; kind: 'offer' | 'bid'; amount_cents: number | null; quantity: number; status: string; created_at: string; thread_id: number; title: string; currency: string; ends_at: string | null; settled: boolean; top: number | null };

const METHOD = { ship: 'Shipping', meetup: 'Meetup' } as const;
const REASON: Record<string, string> = { unpaid: "buyer didn't pay", unavailable: 'no longer available', changed: 'changed their mind', other: 'other' };
const myTurn = (d: Deal, me: User) => {
  const step = STEPS[d.method][d.status];
  return !!step && (step.who === 'buyer' ? d.buyer_id : d.seller_id) === me.id;
};

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
  return (
    <li id={`d${d.id}`} className={`dealcard${turn ? ' turn' : ''}${d.status === 'cancelled' ? ' cancelled' : ''}`}>
      <div className="dc-head">
        <span className={`pill mono${turn ? ' on' : ''}`}>{role === 'seller' ? 'Selling' : 'Buying'}</span>
        {d.live ? <Link className="dc-title" href={`/forum/t/${d.thread_id}`}>{d.title}</Link> : <span className="dc-title">{d.title}</span>}
        <span className="dc-amount">{total != null ? money(total, d.currency) : 'Trade'}</span>
      </div>
      <p className="dc-meta mono">
        <span className="mute">{role === 'seller' ? 'To' : 'From'}</span>
        <Avatar name={other} size={18} />
        {other ? <Link href={`/u/${encodeURIComponent(other)}`}>{other}</Link> : 'gone'}
        <span className="mute">/ {d.quantity > 1 ? `${d.quantity}x / ` : ''}{METHOD[d.method]}{d.ship_cents ? ` (+${money(d.ship_cents, d.currency)})` : ''} / {d.source === 'auction' ? 'auction' : d.source === 'offer' ? 'offer' : 'bought'} {ago(d.created_at)}</span>
      </p>
      {d.note && <p className="dc-note">{d.note}</p>}

      {d.status === 'cancelled' ? (
        <p className="dc-state mono">Cancelled by {d.cancelled_by === me.id ? 'you' : other ?? 'them'}{d.cancel_reason ? `: ${REASON[d.cancel_reason] ?? d.cancel_reason}` : ''}</p>
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

export default async function Market({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  await settleAuctions();
  const tab = ['listings', 'offers', 'history'].includes(sp.tab ?? '') ? sp.tab! : 'todo';

  const [deals, mine, incoming, outgoing, rep] = await Promise.all([
    q<Deal>(
      `SELECT d.*, s.username AS seller, b.username AS buyer,
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
      `SELECT t.id, t.title, t.price, t.status, substring(t.body from '\\[img:([A-Za-z0-9_-]{16})\\]') AS cover,
              l.mode, l.quantity, l.sold_count, l.currency, l.ends_at, l.settled,
              (SELECT count(*) FROM offers WHERE listing_id = t.id AND kind = 'offer' AND status = 'pending')::int AS offers,
              (SELECT count(*) FROM offers WHERE listing_id = t.id AND kind = 'bid')::int AS bids
         FROM listings l JOIN threads t ON t.id = l.thread_id
        WHERE l.seller_id = $1 AND NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now())
        ORDER BY t.created_at DESC`,
      [me.id],
    ),
    q<Incoming>(
      `SELECT o.id, o.amount_cents, o.quantity, o.method, o.note, o.created_at, m.username AS buyer, t.id AS thread_id, t.title, l.currency
         FROM offers o JOIN listings l ON l.thread_id = o.listing_id JOIN threads t ON t.id = o.listing_id LEFT JOIN members m ON m.id = o.buyer_id
        WHERE l.seller_id = $1 AND o.kind = 'offer' AND o.status = 'pending' AND NOT t.deleted
        ORDER BY o.created_at`,
      [me.id],
    ),
    q<Outgoing>(
      `SELECT o.id, o.kind, o.amount_cents, o.quantity, o.status, o.created_at, t.id AS thread_id, t.title, l.currency, l.ends_at, l.settled,
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
  const todo = active.filter((d) => myTurn(d, me));
  const waiting = active.filter((d) => !myTurn(d, me));
  // One line per auction (your best bid); offers newest first.
  const seen = new Set<number>();
  const mineOut = outgoing.filter((o) => o.kind === 'offer' || (!seen.has(o.thread_id) && seen.add(o.thread_id)))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const totals = (role: 'seller' | 'buyer') => {
    const sums = new Map<string, number>();
    for (const d of deals) if (d.status === 'complete' && (role === 'seller' ? d.seller_id : d.buyer_id) === me.id && d.amount_cents != null) {
      sums.set(d.currency, (sums.get(d.currency) ?? 0) + d.amount_cents + (d.ship_cents ?? 0));
    }
    return [...sums].map(([c, v]) => money(v, c)).join(' + ') || money(0);
  };

  const TABS = [
    { id: 'todo', name: `To do${todo.length + incoming.length ? ` ${todo.length + incoming.length}` : ''}`, href: '/market' },
    { id: 'listings', name: `Listings ${mine.length}`, href: '/market?tab=listings' },
    { id: 'offers', name: 'Offers & bids', href: '/market?tab=offers' },
    { id: 'history', name: 'History', href: '/market?tab=history' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">Market</h1>
          <p className="mono mute stat-line">{[repLine(rep), rep.sold ? `sold ${totals('seller')}` : '', rep.bought ? `bought ${totals('buyer')}` : ''].filter(Boolean).join(' / ')}</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/forum/market">Browse</Link>
          <Link className="btn solid" href="/forum/market/new">New listing</Link>
        </div>
      </div>
      <Notice ok={sp.ok} error={sp.error} />
      <SortTabs label="Market" items={TABS} current={tab} />

      {tab === 'todo' && (
        <>
          {incoming.length > 0 && (
            <section className="mk-sec">
              <div className="sec-head mono"><span className="br">Offers to answer</span></div>
              <ul className="mk-list">
                {incoming.map((o) => (
                  <li key={o.id} className="mk-row">
                    <span className="mk-main">
                      <Link className="mk-title" href={`/forum/t/${o.thread_id}`}>{o.title}</Link>
                      <span className="mono mute">{o.buyer ?? 'gone'} offers <b className="bone">{o.amount_cents != null ? money(o.amount_cents, o.currency) : 'a trade'}</b>{o.quantity > 1 ? ` for ${o.quantity}` : ''}{o.method ? ` / ${METHOD[o.method as Method]}` : ''} / {ago(o.created_at)}</span>
                      {o.note && <span className="dl-note">{o.note}</span>}
                    </span>
                    <span className="dl-acts">
                      <form action={respondOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="do" value="accept" /><input type="hidden" name="back" value="/market" /><button className="btn small solid" type="submit">Accept</button></form>
                      <form action={respondOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="do" value="decline" /><input type="hidden" name="back" value="/market" /><button className="btn small" type="submit">Decline</button></form>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="mk-sec">
            <div className="sec-head mono"><span className="br">Your turn</span></div>
            {todo.length ? <ul className="dealcards">{todo.map((d) => <DealCard key={d.id} d={d} me={me} />)}</ul> : <p className="empty mono">Nothing waiting on you.</p>}
          </section>
          {waiting.length > 0 && (
            <section className="mk-sec">
              <div className="sec-head mono"><span className="br">In progress</span></div>
              <ul className="dealcards">{waiting.map((d) => <DealCard key={d.id} d={d} me={me} />)}</ul>
            </section>
          )}
        </>
      )}

      {tab === 'listings' && (
        mine.length ? (
          <ul className="mk-list inv">
            {mine.map((m) => {
              const left_ = Math.max(0, m.quantity - m.sold_count);
              return (
                <li key={m.id} className="mk-row">
                  <Link className="inv-cover" href={`/forum/t/${m.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.cover ? <img src={mediaUrl(m.cover)} alt="" loading="lazy" /> : <span className="cover-blank" />}
                  </Link>
                  <span className="mk-main">
                    <Link className="mk-title" href={`/forum/t/${m.id}`}>{m.title}</Link>
                    <span className="mono mute">
                      {m.mode === 'auction' ? (m.settled ? (m.sold_count ? 'Auction sold' : 'Auction ended') : `Auction / ${m.bids} ${m.bids === 1 ? 'bid' : 'bids'} / ${m.ends_at ? `${left(m.ends_at)} left` : ''}`)
                        : m.mode === 'wanted' ? 'Wanted' : `${m.sold_count} sold`}
                      {m.offers ? ` / ${m.offers} ${m.offers === 1 ? 'offer' : 'offers'}` : ''}
                      {m.status === 'closed' ? ' / closed' : ''}
                    </span>
                  </span>
                  <span className="inv-price">{m.price}</span>
                  {(m.mode === 'fixed' || m.mode === 'offers') && (
                    <form action={setStock} className="stock-form mono">
                      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value="/market?tab=listings" />
                      <label>Left <input className="input small-num" type="number" name="left" min={0} max={999} defaultValue={left_} /></label>
                      <button className="linkbtn mono" type="submit">Save</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="empty mono">No listings. <Link href="/forum/market/new">New listing &rarr;</Link></p>
      )}

      {tab === 'offers' && (
        mineOut.length ? (
          <ul className="mk-list">
            {mineOut.map((o) => {
              const leading = o.kind === 'bid' && o.amount_cents === o.top;
              const state = o.kind === 'bid'
                ? (o.settled ? (o.status === 'won' ? 'Won' : 'Lost') : leading ? 'Leading' : 'Outbid')
                : o.status;
              return (
                <li key={o.id} className="mk-row">
                  <span className="mk-main">
                    <Link className="mk-title" href={`/forum/t/${o.thread_id}`}>{o.title}</Link>
                    <span className="mono mute">
                      {o.kind === 'bid' ? 'Your bid' : 'Your offer'} {o.amount_cents != null ? money(o.amount_cents, o.currency) : '(trade)'}
                      {o.kind === 'bid' && !o.settled && o.ends_at ? ` / ends in ${left(o.ends_at)}` : ''} / {ago(o.created_at)}
                    </span>
                  </span>
                  <span className={`pill mono${state === 'Leading' || state === 'Won' || state === 'accepted' ? ' on' : ''}`}>{state}</span>
                  {o.kind === 'offer' && o.status === 'pending' && (
                    <form action={withdrawOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="back" value="/market?tab=offers" /><button className="linkbtn mono mute" type="submit">Withdraw</button></form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="empty mono">No offers or bids.</p>
      )}

      {tab === 'history' && (
        done.length ? <ul className="dealcards">{done.map((d) => <DealCard key={d.id} d={d} me={me} />)}</ul> : <p className="empty mono">No finished deals.</p>
      )}
    </>
  );
}
