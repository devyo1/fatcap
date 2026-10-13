import Link from 'next/link';
import type { User } from '@/lib/auth';
import { money } from '@/lib/money';
import { left, ago } from '@/lib/format';
import { available, auctionOpen, nextBid, methods, type Listing, type Bid, type Rep } from '@/lib/market';
import { buy, makeOffer, respondOffer, withdrawOffer, placeBid, setListingState } from '@/app/market-actions';
import Avatar from './Avatar';
import Countdown from './Countdown';

export type PendingOffer = { id: number; buyer: string | null; amount_cents: number | null; quantity: number; method: string | null; note: string | null; created_at: string };

const METHOD = { ship: 'Shipping', meetup: 'Meetup' } as const;

/** "12 deals / all good", "3 deals / 1 bad", "No deals yet" */
export function repLine(r: Rep) {
  const n = r.sold + r.bought;
  if (!n && !r.unpaid) return 'No deals yet';
  const parts = [`${n} ${n === 1 ? 'deal' : 'deals'}`];
  if (r.good || r.bad) parts.push(r.bad ? `${r.good} good, ${r.bad} bad` : 'all good');
  if (r.unpaid) parts.push(`${r.unpaid} unpaid`);
  return parts.join(' / ');
}

function MethodPicker({ l, name = 'method' }: { l: Listing; name?: string }) {
  const ms = methods(l);
  if (ms.length < 2) return <input type="hidden" name={name} value={ms[0] ?? 'meetup'} />;
  return (
    <div className="seg-radio mono" role="radiogroup" aria-label="Delivery">
      {ms.map((m, i) => (
        <label key={m}><input type="radio" name={name} value={m} defaultChecked={i === 0} /><span>{METHOD[m]}{m === 'ship' && l.ship_cents ? ` +${money(l.ship_cents, l.currency)}` : ''}</span></label>
      ))}
    </div>
  );
}

/**
 * The sell side of a Market thread: price or current bid, stock, delivery, the seller's record,
 * and the actions. Buyers: buy / offer / bid / message. Seller: offers to answer, bids, close.
 */
export default function DealBox({ thread, l, status, me, rep, myRep, bids, offers, myOffer, myDealId }: {
  thread: { id: number; title: string; author: string | null; user_id: number | null };
  l: Listing; status: string | null; me: User; rep: Rep; myRep: Rep | null;
  bids: Bid[]; offers: PendingOffer[]; myOffer: PendingOffer | null; myDealId: number | null;
}) {
  const own = l.seller_id === me.id;
  const here = `/forum/t/${thread.id}`;
  const left_ = available(l);
  const closed = status === 'closed';
  const top = bids[0] ?? null;
  const live = auctionOpen(l);
  const min = nextBid(l, top?.amount_cents ?? null);
  const canBuy = !own && !closed && l.mode === 'fixed' && left_ > 0;
  const canOffer = !own && !closed && left_ > 0 && (l.mode === 'offers' || (l.mode === 'fixed' && l.accept_offers));
  const trusted = !l.min_deals || (myRep && myRep.sold + myRep.bought >= l.min_deals);
  const soldOut = l.mode !== 'auction' && l.mode !== 'wanted' && left_ <= 0;
  // Bidders stay anonymous to each other: "Bidder 1, 2, ..." in the order they joined. The seller sees names.
  const alias = new Map<number | null, number>();
  for (const b of [...bids].sort((a, c) => +new Date(a.created_at) - +new Date(c.created_at))) if (!alias.has(b.buyer_id)) alias.set(b.buyer_id, alias.size + 1);

  return (
    <section className={`deal${soldOut || closed || (l.mode === 'auction' && !live) ? ' done' : ''}`} aria-label="Listing">
      <div className="deal-top">
        <div className="deal-price">
          {l.mode === 'auction' ? (
            <>
              <span className="mono mute">{live ? (top ? 'Current bid' : 'Starting bid') : top ? 'Winning bid' : 'Ended, no bids'}</span>
              <b>{money(top?.amount_cents ?? l.price_cents, l.currency)}</b>
              <span className="mono mute">{bids.length} {bids.length === 1 ? 'bid' : 'bids'}</span>
            </>
          ) : l.mode === 'wanted' ? (
            <><span className="mono mute">Budget</span><b>{l.price_cents != null ? money(l.price_cents, l.currency) : 'Open'}</b></>
          ) : (
            <>
              <span className="mono mute">{l.mode === 'offers' ? (l.price_cents != null ? 'Asking' : 'Offers') : 'Price'}</span>
              <b>{l.price_cents != null ? money(l.price_cents, l.currency) : 'Make an offer'}</b>
              {l.mode === 'fixed' && l.accept_offers && <span className="mono mute">or offer</span>}
            </>
          )}
        </div>
        <span className="pill mono deal-state">
          {closed ? 'Closed' : soldOut ? 'Sold out' : l.mode === 'auction' ? (live ? 'Auction' : l.sold_count ? 'Sold' : 'Ended') : l.mode === 'wanted' ? 'Wanted' : 'Available'}
        </span>
      </div>

      {/* buyer side */}
      {!own && (
        <div className="deal-actions">
          {myDealId && <p className="notice mono deal-note">You have a deal on this. <Link href={`/market?tab=buying#d${myDealId}`}>Open it &rarr;</Link></p>}
          {canBuy && (
            <details className="deal-pop">
              <summary className="btn solid">Buy</summary>
              <form action={buy} className="deal-form">
                <input type="hidden" name="id" value={thread.id} />
                {left_ > 1 && (
                  <label className="mono">Quantity <input className="input small-num" type="number" inputMode="numeric" name="quantity" min={1} max={left_} defaultValue={1} /></label>
                )}
                <MethodPicker l={l} />
                <input className="input" name="note" maxLength={300} placeholder="Note to seller (optional)" autoComplete="off" />
                <p className="hint mono">Buying opens a deal with {thread.author ?? 'the seller'}. Pay them directly, then mark it paid.</p>
                <button className="btn solid" type="submit">Commit to buy</button>
              </form>
            </details>
          )}
          {canOffer && (
            <details className="deal-pop">
              <summary className="btn">{myOffer ? 'Change offer' : 'Make offer'}</summary>
              <form action={makeOffer} className="deal-form">
                <input type="hidden" name="id" value={thread.id} />
                <div className="field-row">
                  <input className="input" name="amount" inputMode="decimal" placeholder={`Amount (${l.currency})`} required={!l.trades} />
                  {left_ > 1 && <input className="input small-num" type="number" inputMode="numeric" name="quantity" min={1} max={left_} defaultValue={1} aria-label="Quantity" />}
                </div>
                <MethodPicker l={l} />
                <input className="input" name="note" maxLength={300} placeholder={l.trades ? 'Note, or what you would trade' : 'Note (optional)'} autoComplete="off" />
                <button className="btn solid" type="submit">Send offer</button>
              </form>
            </details>
          )}
          {l.mode === 'auction' && live && (
            trusted ? (
              <form action={placeBid} className="deal-form bid-form">
                <input type="hidden" name="id" value={thread.id} />
                <div className="bid-row">
                  <input className="input" name="amount" inputMode="decimal" required placeholder={`${money(min, l.currency)} or more`} aria-label="Your bid" />
                  <button className="btn solid" type="submit">Bid</button>
                </div>
                <MethodPicker l={l} />
                <p className="hint mono">Bids are binding. A winner who doesn&apos;t pay gets marked unpaid.</p>
              </form>
            ) : <p className="hint mono">Bidding needs {l.min_deals}+ completed deals.</p>
          )}
          {thread.author && <Link className="btn" href={`/messages/${encodeURIComponent(thread.author)}?about=${thread.id}`}>Message</Link>}
          {myOffer && (
            <form action={withdrawOffer} className="my-offer mono">
              <input type="hidden" name="offer" value={myOffer.id} /><input type="hidden" name="back" value={here} />
              <span>Your offer: {myOffer.amount_cents != null ? money(myOffer.amount_cents, l.currency) : 'trade'}{myOffer.quantity > 1 ? ` for ${myOffer.quantity}` : ''}, pending</span>
              <button className="linkbtn mono mute" type="submit">Withdraw</button>
            </form>
          )}
        </div>
      )}

      {/* seller side */}
      {own && (
        <div className="deal-actions">
          <Link className="btn small" href={`${here}?edit=thread`}>Edit listing</Link>
          <Link className="btn small" href="/market?tab=selling">Your market</Link>
          {l.mode !== 'auction' && (
            <form action={setListingState}>
              <input type="hidden" name="id" value={thread.id} /><input type="hidden" name="do" value={closed ? 'reopen' : 'close'} /><input type="hidden" name="back" value={here} />
              <button className="btn small" type="submit">{closed ? 'Reopen' : 'Close listing'}</button>
            </form>
          )}
          {l.mode === 'auction' && l.settled && !l.sold_count && (
            <form action={setListingState}>
              <input type="hidden" name="id" value={thread.id} /><input type="hidden" name="do" value="relist" /><input type="hidden" name="days" value="3" /><input type="hidden" name="back" value={here} />
              <button className="btn small solid" type="submit">Run again (3 days)</button>
            </form>
          )}
        </div>
      )}
      <ul className="deal-facts mono">
        {l.mode === 'auction' && l.ends_at && live && <li><span className="mute">Ends in</span> <Countdown to={l.ends_at} initial={left(l.ends_at)} /></li>}
        {(l.mode === 'fixed' || l.mode === 'offers') && <li><span className="mute">In stock</span> {left_}{l.quantity > 1 ? ` of ${l.quantity}` : ''}</li>}
        {l.ships && <li><span className="mute">Ships</span> {l.ship_cents ? `+${money(l.ship_cents, l.currency)}` : 'included'}{l.ship_note ? `, ${l.ship_note}` : ''}</li>}
        {l.meetup && <li><span className="mute">Meetup</span> {l.meetup_area ?? 'arrange by message'}</li>}
        {l.trades && <li><span className="mute">Trades</span> open</li>}
        {l.mode === 'auction' && l.min_deals > 0 && <li><span className="mute">Bidders</span> {l.min_deals}+ completed deals</li>}
        {l.mode === 'auction' && live && <li><span className="mute">Raise</span> {money(l.increment_cents || 100, l.currency)} min</li>}
      </ul>

      <div className="deal-seller">
        <Avatar name={thread.author} size={26} />
        <span>
          {thread.author ? <Link className="who" href={`/u/${encodeURIComponent(thread.author)}`}>{thread.author}</Link> : <span className="who">gone</span>}
          <span className="mono mute">{repLine(rep)}</span>
        </span>
      </div>

      {own && offers.length > 0 && (
        <div className="deal-list">
          <span className="mono mute br">Offers</span>
          <ul>
            {offers.map((o) => (
              <li key={o.id}>
                <span className="dl-main">
                  <b>{o.amount_cents != null ? money(o.amount_cents, l.currency) : 'Trade'}</b>
                  <span className="mono mute">{o.buyer ?? 'gone'}{o.quantity > 1 ? ` / ${o.quantity}x` : ''}{o.method ? ` / ${METHOD[o.method as keyof typeof METHOD]}` : ''} / {ago(o.created_at)}</span>
                  {o.note && <span className="dl-note">{o.note}</span>}
                </span>
                <span className="dl-acts">
                  <form action={respondOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="do" value="accept" /><input type="hidden" name="back" value={here} /><button className="btn small solid" type="submit">Accept</button></form>
                  <form action={respondOffer}><input type="hidden" name="offer" value={o.id} /><input type="hidden" name="do" value="decline" /><input type="hidden" name="back" value={here} /><button className="btn small" type="submit">Decline</button></form>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {l.mode === 'auction' && bids.length > 0 && (
        <div className="deal-list">
          <span className="mono mute br">Bids</span>
          <ul className="bids">
            {bids.slice(0, 10).map((b, i) => (
              <li key={b.id} className={i === 0 ? 'lead' : ''}>
                <b>{money(b.amount_cents, l.currency)}</b>
                <span className="mono mute">
                  {b.buyer_id === me.id ? 'You' : own ? b.bidder ?? 'gone' : `Bidder ${alias.get(b.buyer_id)}`} / {ago(b.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
