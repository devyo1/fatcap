import 'server-only';
import { q, one } from './db';
import { money } from './money';
import { notify } from './notify';

// The market runs on handshakes: the site records who agreed to what and walks both people
// through the deal (paid -> confirmed -> shipped -> received). No money moves through it.
// Auctions can't check anyone's funds, so they lean on track record instead: bids are binding,
// sellers can require bidders to have completed deals, a winner who doesn't pay gets an
// "unpaid" mark on their market profile, and the seller can offer the item to the next bidder.

export type Mode = 'fixed' | 'offers' | 'auction' | 'wanted';
export type Method = 'ship' | 'meetup';
export const AUCTION_DAYS = [1, 3, 5, 7] as const;
export const TRUST_LEVELS = [0, 1, 3, 5] as const;
const SNIPE_MS = 2 * 60_000; // a bid in the last 2 minutes pushes the end back 2 minutes

export type Listing = {
  thread_id: number; seller_id: number | null; mode: Mode; price_cents: number | null; currency: string;
  accept_offers: boolean; quantity: number; sold_count: number;
  ships: boolean; ship_cents: number | null; ship_note: string | null; meetup: boolean; meetup_area: string | null; trades: boolean;
  ends_at: string | null; increment_cents: number | null; min_deals: number; settled: boolean;
};
export type Bid = { id: number; buyer_id: number | null; bidder: string | null; amount_cents: number; method: Method | null; created_at: string };

export const available = (l: Listing) => Math.max(0, l.quantity - l.sold_count);
export const auctionOpen = (l: Listing) => l.mode === 'auction' && !l.settled && !!l.ends_at && new Date(l.ends_at).getTime() > Date.now();
export const increment = (l: Listing) => l.increment_cents || 100;
export const nextBid = (l: Listing, top: number | null) => (top == null ? l.price_cents ?? 100 : top + increment(l));
export const methods = (l: Listing): Method[] => [...(l.ships ? ['ship' as const] : []), ...(l.meetup ? ['meetup' as const] : [])];

export async function getListing(threadId: number) {
  return one<Listing>('SELECT * FROM listings WHERE thread_id = $1', [threadId]);
}

/** Bids on an auction (all of them, once it has ended), highest first. */
export async function bidsFor(threadId: number, limit = 50) {
  return q<Bid>(
    `SELECT o.id, o.buyer_id, m.username AS bidder, o.amount_cents, o.method, o.created_at
       FROM offers o LEFT JOIN members m ON m.id = o.buyer_id
      WHERE o.listing_id = $1 AND o.kind = 'bid' AND o.status IN ('active', 'won', 'lost')
      ORDER BY o.amount_cents DESC, o.created_at ASC LIMIT $2`,
    [threadId, limit],
  );
}

export type Rep = { sold: number; bought: number; good: number; bad: number; unpaid: number };

/** A member's market record: completed sales and purchases, feedback, unpaid wins. */
export async function reputation(memberId: number): Promise<Rep> {
  const r = await one<Rep>(
    `SELECT count(*) FILTER (WHERE seller_id = $1 AND status = 'complete')::int AS sold,
            count(*) FILTER (WHERE buyer_id = $1 AND status = 'complete')::int AS bought,
            count(*) FILTER (WHERE (seller_id = $1 AND buyer_rating = 'good') OR (buyer_id = $1 AND seller_rating = 'good'))::int AS good,
            count(*) FILTER (WHERE (seller_id = $1 AND buyer_rating = 'bad') OR (buyer_id = $1 AND seller_rating = 'bad'))::int AS bad,
            count(*) FILTER (WHERE buyer_id = $1 AND status = 'cancelled' AND cancel_reason = 'unpaid')::int AS unpaid
       FROM deals WHERE seller_id = $1 OR buyer_id = $1`,
    [memberId],
  );
  return r ?? { sold: 0, bought: 0, good: 0, bad: 0, unpaid: 0 };
}

/** Keep the thread's display price and status in step with the listing (lists and cards read these). */
export async function syncDisplay(threadId: number) {
  const l = await getListing(threadId);
  if (!l) return;
  let price = '';
  let status = 'open';
  if (l.mode === 'auction') {
    const top = await one<{ amount_cents: number }>(`SELECT max(amount_cents) AS amount_cents FROM offers WHERE listing_id = $1 AND kind = 'bid' AND status IN ('active', 'won')`, [threadId]);
    price = money(top?.amount_cents ?? l.price_cents, l.currency);
    if (l.settled) status = l.sold_count > 0 ? 'sold' : 'ended';
  } else if (l.mode === 'wanted') {
    price = l.price_cents != null ? `Budget ${money(l.price_cents, l.currency)}` : 'Wanted';
  } else {
    price = l.price_cents != null ? money(l.price_cents, l.currency) : 'Offers';
    if (available(l) <= 0) status = 'sold';
  }
  const t = await one<{ status: string | null }>('SELECT status FROM threads WHERE id = $1', [threadId]);
  if (t?.status === 'closed' && status === 'open') status = 'closed';
  await q('UPDATE threads SET price = $2, status = $3 WHERE id = $1', [threadId, price, status]);
}

/** Close auctions whose time is up: the top bid wins and becomes a deal. At most every 30s per server. */
let lastSettle = 0;
export async function settleAuctions(force = false) {
  if (!force && Date.now() - lastSettle < 30_000) return;
  lastSettle = Date.now();
  const due = await q<{ thread_id: number }>(
    `UPDATE listings SET settled = true WHERE mode = 'auction' AND NOT settled AND ends_at <= now() RETURNING thread_id`,
  );
  for (const { thread_id } of due) {
    const [l, t] = await Promise.all([
      getListing(thread_id),
      one<{ title: string }>('SELECT title FROM threads WHERE id = $1', [thread_id]),
    ]);
    if (!l || !t) continue;
    const [top] = await bidsFor(thread_id, 1);
    if (top?.buyer_id && l.seller_id) {
      const deal = await one<{ id: number }>(
        `INSERT INTO deals (thread_id, title, seller_id, buyer_id, offer_id, source, amount_cents, ship_cents, currency, quantity, method)
         VALUES ($1, $2, $3, $4, $5, 'auction', $6, $7, $8, 1, $9) RETURNING id`,
        [thread_id, t.title, l.seller_id, top.buyer_id, top.id, top.amount_cents,
          (top.method ?? (l.ships ? 'ship' : 'meetup')) === 'ship' ? l.ship_cents : null, l.currency, top.method ?? (l.ships ? 'ship' : 'meetup')],
      );
      await q(`UPDATE offers SET status = CASE WHEN id = $2 THEN 'won' ELSE 'lost' END, decided_at = now() WHERE listing_id = $1 AND kind = 'bid' AND status = 'active'`, [thread_id, top.id]);
      await q('UPDATE listings SET sold_count = 1 WHERE thread_id = $1', [thread_id]);
      await notify([{ kind: 'won', ids: [top.buyer_id] }], l.seller_id, { threadId: thread_id, dealId: deal?.id });
      await notify([{ kind: 'auction_ended', ids: [l.seller_id] }], top.buyer_id, { threadId: thread_id, dealId: deal?.id });
    } else if (l.seller_id) {
      await notify([{ kind: 'auction_ended', ids: [l.seller_id] }], null, { threadId: thread_id });
    }
    await syncDisplay(thread_id);
  }
}

/** Anti-sniping: a bid close to the end gives everyone a little more time. Returns the new end, if moved. */
export async function extendIfLate(threadId: number, endsAt: string) {
  if (new Date(endsAt).getTime() - Date.now() < SNIPE_MS) {
    await q('UPDATE listings SET ends_at = $2 WHERE thread_id = $1', [threadId, new Date(Date.now() + SNIPE_MS)]);
  }
}

/* ---------- deals ---------- */

export type DealStatus = 'agreed' | 'paid' | 'confirmed' | 'sent' | 'complete' | 'cancelled';
type Step = { next: DealStatus; who: 'buyer' | 'seller'; label: string; stamp: string };

/** Who moves a deal forward, and how. Shipped deals have two more steps than meetups. */
export const STEPS: Record<Method, Partial<Record<DealStatus, Step>>> = {
  ship: {
    agreed: { next: 'paid', who: 'buyer', label: 'Mark as paid', stamp: 'paid_at' },
    paid: { next: 'confirmed', who: 'seller', label: 'Confirm payment', stamp: 'confirmed_at' },
    confirmed: { next: 'sent', who: 'seller', label: 'Mark as shipped', stamp: 'sent_at' },
    sent: { next: 'complete', who: 'buyer', label: 'Mark as received', stamp: 'completed_at' },
  },
  meetup: {
    agreed: { next: 'paid', who: 'buyer', label: 'Mark as paid', stamp: 'paid_at' },
    paid: { next: 'complete', who: 'seller', label: 'Confirm payment', stamp: 'completed_at' },
  },
};
export const TRACK: Record<Method, { status: DealStatus; label: string }[]> = {
  ship: [{ status: 'agreed', label: 'Agreed' }, { status: 'paid', label: 'Paid' }, { status: 'confirmed', label: 'Confirmed' }, { status: 'sent', label: 'Shipped' }, { status: 'complete', label: 'Received' }],
  meetup: [{ status: 'agreed', label: 'Agreed' }, { status: 'paid', label: 'Paid' }, { status: 'complete', label: 'Done' }],
};
export const CANCEL_REASONS = {
  buyer: [{ id: 'changed', label: 'Changed my mind' }, { id: 'other', label: 'Other' }],
  seller: [{ id: 'unpaid', label: "Buyer didn't pay" }, { id: 'unavailable', label: 'No longer available' }, { id: 'other', label: 'Other' }],
} as const;

/** The buyer can back out before paying; the seller any time before it's done. */
export const canCancel = (status: DealStatus, role: 'buyer' | 'seller') =>
  role === 'buyer' ? status === 'agreed' : status !== 'complete' && status !== 'cancelled';

const PENDING_OFFERS = `SELECT count(*) FROM offers o JOIN listings l ON l.thread_id = o.listing_id JOIN threads t ON t.id = o.listing_id
  WHERE l.seller_id = $1 AND o.kind = 'offer' AND o.status = 'pending' AND NOT t.deleted`;

/** Things waiting on this member: their turn in a deal, or offers on their listings. */
export async function marketTodo(memberId: number) {
  const r = await one<{ n: number }>(
    `SELECT (SELECT count(*) FROM deals WHERE (buyer_id = $1 AND status IN ('agreed', 'sent')) OR (seller_id = $1 AND status IN ('paid', 'confirmed')))::int
          + (${PENDING_OFFERS})::int AS n`,
    [memberId],
  );
  return r?.n ?? 0;
}

export type OpenDeal = { id: number; title: string; role: 'buyer' | 'seller'; other: string | null; next: string | null };

/** A member's deals still in motion (the ones waiting on them first), and offers they haven't answered. */
export async function openDeals(memberId: number) {
  const [rows, offers] = await Promise.all([
    q<{ id: number; title: string; method: Method; status: DealStatus; seller_id: number | null; seller: string | null; buyer: string | null }>(
      `SELECT d.id, d.title, d.method, d.status, d.seller_id, s.username AS seller, b.username AS buyer
         FROM deals d LEFT JOIN members s ON s.id = d.seller_id LEFT JOIN members b ON b.id = d.buyer_id
        WHERE (d.seller_id = $1 OR d.buyer_id = $1) AND d.status NOT IN ('complete', 'cancelled')
        ORDER BY d.updated_at DESC LIMIT 50`,
      [memberId],
    ),
    one<{ n: number }>(`SELECT (${PENDING_OFFERS})::int AS n`, [memberId]),
  ]);
  const deals: OpenDeal[] = rows.map((d) => {
    const role = d.seller_id === memberId ? 'seller' : 'buyer';
    const step = STEPS[d.method][d.status];
    return { id: d.id, title: d.title, role, other: role === 'seller' ? d.buyer : d.seller, next: step?.who === role ? step.label : null };
  });
  deals.sort((a, b) => Number(!!b.next) - Number(!!a.next));
  return { deals, offers: offers?.n ?? 0 };
}
