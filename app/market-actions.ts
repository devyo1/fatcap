'use server';

import { redirect } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CITY, LIMITS, parsePlace, vanishDays, isMarket } from '@/lib/config';
import { str } from '@/lib/format';
import { toCents, isCurrency, money } from '@/lib/money';
import {
  getListing, available, auctionOpen, nextBid, methods, bidsFor, reputation, syncDisplay, extendIfLate, settleAuctions,
  STEPS, CANCEL_REASONS, canCancel, AUCTION_DAYS, TRUST_LEVELS, type Mode, type Method, type DealStatus,
} from '@/lib/market';
import { notify, idsForNames, type NotifyKind } from '@/lib/notify';
import { pinThreadMedia } from '@/lib/media';
import { LIVE } from '@/lib/threads';
import { mentionsIn } from '@/components/RichText';

const go = (path: string, key: 'error' | 'ok', msg: string, hash = ''): never =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}${hash}`);
const fail = (path: string, msg: string): never => go(path, 'error', msg);
const int = (v: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : fallback;
};
const safeBack = (p: string, fallback: string) => (p.startsWith('/') && !p.startsWith('//') ? p : fallback);

/** A live Market thread with its listing. */
async function liveListing(id: number) {
  const t = await one<{ id: number; title: string; user_id: number | null }>(`SELECT id, title, user_id FROM threads t WHERE id = $1 AND ${LIVE}`, [id]);
  const l = t ? await getListing(id) : null;
  return t && l ? { t, l } : null;
}

type Fields = {
  mode: Mode; currency: string; price_cents: number | null; quantity: number; accept_offers: boolean;
  ships: boolean; ship_cents: number | null; ship_note: string | null; meetup: boolean; meetup_area: string | null; trades: boolean;
  days: number; increment_cents: number | null; min_deals: number;
};

/** How the listing sells, read from the form. Wanted posts only carry a budget. */
function readFields(form: FormData, topic: string): Fields | { error: string } {
  const picked = str(form.get('mode'));
  const mode: Mode = topic === 'wanted' ? 'wanted' : picked === 'offers' || picked === 'auction' ? picked : 'fixed';
  const currency = isCurrency(str(form.get('currency'))) ? str(form.get('currency')) : 'CAD';
  const price = toCents(str(form.get(mode === 'auction' ? 'start' : 'price')));
  if (mode === 'fixed' && !price) return { error: 'Set a price.' };
  if (mode === 'auction' && !price) return { error: 'Set a starting bid.' };
  const ships = form.get('ships') === 'on';
  const meetup = form.get('meetup') === 'on';
  if (mode !== 'wanted' && !ships && !meetup) return { error: 'Choose shipping, meetup, or both.' };
  const days = int(form.get('days'), 1, 7, 3);
  const trust = int(form.get('min_deals'), 0, 5, 0);
  return {
    mode, currency, price_cents: price,
    quantity: mode === 'auction' || mode === 'wanted' ? 1 : int(form.get('quantity'), 1, 999, 1),
    accept_offers: mode === 'fixed' && form.get('accept_offers') === 'on',
    ships, ship_cents: ships ? toCents(str(form.get('ship_cost'))) : null,
    ship_note: ships ? str(form.get('ship_note')).trim().slice(0, 80) || null : null,
    meetup, meetup_area: meetup ? str(form.get('meetup_area')).trim().slice(0, 60) || null : null,
    trades: mode !== 'wanted' && form.get('trades') === 'on',
    days: (AUCTION_DAYS as readonly number[]).includes(days) ? days : 3,
    increment_cents: mode === 'auction' ? toCents(str(form.get('increment'))) || 100 : null,
    min_deals: mode === 'auction' && (TRUST_LEVELS as readonly number[]).includes(trust) ? trust : 0,
  };
}

function vanishFrom(v: string): Date | null | undefined {
  if (v === 'never') return null;
  const days = vanishDays(v);
  return days ? new Date(Date.now() + days * 864e5) : undefined;
}

/* ---------- listings ---------- */

export async function createListing(form: FormData) {
  const me = await requireUser();
  const place = parsePlace(str(form.get('place')));
  const path = `/forum/market/new${place ? `?in=${place.topic}` : ''}`;
  if (!place || !isMarket(place.board)) fail(path, 'Select a section.');
  const title = str(form.get('title')).trim();
  const body = str(form.get('body')).trim();
  if (!title) fail(path, 'Title required.');
  if (!body) fail(path, 'Add some details.');
  if (title.length > LIMITS.title || body.length > LIMITS.body) fail(path, 'Too long.');
  const f = readFields(form, place!.topic);
  if ('error' in f) return fail(path, f.error);
  const expires = vanishFrom(str(form.get('vanish'))) ?? null;

  const t = await one<{ id: number }>(
    `INSERT INTO threads (city, board, topic, user_id, title, body, expires_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open') RETURNING id`,
    [CITY, place!.board, place!.topic, me.id, title, body, expires],
  );
  await q(
    `INSERT INTO listings (thread_id, seller_id, mode, price_cents, currency, accept_offers, quantity, ships, ship_cents, ship_note,
                           meetup, meetup_area, trades, ends_at, increment_cents, min_deals)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [t!.id, me.id, f.mode, f.price_cents, f.currency, f.accept_offers, f.quantity, f.ships, f.ship_cents, f.ship_note,
      f.meetup, f.meetup_area, f.trades, f.mode === 'auction' ? new Date(Date.now() + f.days * 864e5) : null, f.increment_cents, f.min_deals],
  );
  await pinThreadMedia(t!.id, body, me.id, expires);
  await q('INSERT INTO thread_follows (member_id, thread_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [me.id, t!.id]);
  await notify([{ kind: 'mention', ids: await idsForNames(mentionsIn(body)) }], me.id, { threadId: t!.id });
  await syncDisplay(t!.id);
  redirect(`/forum/t/${t!.id}`);
}

/** Edit a listing. Once an auction has bids, only the text and delivery can change. */
export async function updateListing(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const path = `/forum/t/${id}?edit=thread`;
  const found = await liveListing(id);
  if (!found || found.t.user_id !== me.id) redirect('/forum');
  const { l } = found!;
  const place = parsePlace(str(form.get('place')));
  if (!place || !isMarket(place.board)) fail(path, 'Select a section.');
  const title = str(form.get('title')).trim();
  const body = str(form.get('body')).trim();
  if (!title || !body) fail(path, 'Title and details are required.');
  if (title.length > LIMITS.title || body.length > LIMITS.body) fail(path, 'Too long.');
  const f = readFields(form, place!.topic);
  if ('error' in f) return fail(path, f.error);

  const bids = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM offers WHERE listing_id = $1 AND kind = 'bid'`, [id]))?.n ?? 0;
  const deals = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM deals WHERE thread_id = $1`, [id]))?.n ?? 0;
  const frozen = l.mode === 'auction' && (bids > 0 || l.settled);
  if (!frozen && f.mode !== l.mode && (bids > 0 || deals > 0)) fail(path, "Can't change how it sells after offers or deals.");
  const startAuction = !frozen && f.mode === 'auction' && l.mode !== 'auction';

  const t = await one<{ expires_at: string | null }>('SELECT expires_at FROM threads WHERE id = $1', [id]);
  const vanish = vanishFrom(str(form.get('vanish')));
  const expires = vanish === undefined ? t?.expires_at ?? null : vanish;
  await q('UPDATE threads SET title = $2, body = $3, topic = $4, expires_at = $5, edited_at = now() WHERE id = $1', [id, title, body, place!.topic, expires]);
  if (frozen) {
    await q(
      `UPDATE listings SET ships = $2, ship_cents = $3, ship_note = $4, meetup = $5, meetup_area = $6, trades = $7 WHERE thread_id = $1`,
      [id, f.ships, f.ship_cents, f.ship_note, f.meetup, f.meetup_area, f.trades],
    );
  } else {
    await q(
      `UPDATE listings SET mode = $2, price_cents = $3, currency = $4, accept_offers = $5, quantity = GREATEST($6, sold_count),
              ships = $7, ship_cents = $8, ship_note = $9, meetup = $10, meetup_area = $11, trades = $12,
              ends_at = CASE WHEN $2 = 'auction' THEN COALESCE(CASE WHEN $13 THEN NULL ELSE ends_at END, $14) ELSE NULL END,
              increment_cents = $15, min_deals = $16
        WHERE thread_id = $1`,
      [id, f.mode, f.price_cents, f.currency, f.accept_offers, f.quantity, f.ships, f.ship_cents, f.ship_note, f.meetup, f.meetup_area, f.trades,
        startAuction, new Date(Date.now() + f.days * 864e5), f.increment_cents, f.min_deals],
    );
  }
  await pinThreadMedia(id, body, me.id, expires);
  await syncDisplay(id);
  redirect(`/forum/t/${id}`);
}

/** Seller: stop selling (close), open it back up, or run an auction that ended unsold again. */
export async function setListingState(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const action = str(form.get('do'));
  const found = await liveListing(id);
  if (!found || found.l.seller_id !== me.id) redirect('/forum');
  const { l } = found!;
  if (action === 'close') {
    await q(`UPDATE threads SET status = 'closed' WHERE id = $1`, [id]);
    await q(`UPDATE offers SET status = 'expired', decided_at = now() WHERE listing_id = $1 AND kind = 'offer' AND status = 'pending'`, [id]);
  } else if (action === 'reopen') {
    await q(`UPDATE threads SET status = 'open' WHERE id = $1`, [id]);
  } else if (action === 'relist' && l.mode === 'auction' && l.settled && l.sold_count === 0) {
    await q(`UPDATE listings SET settled = false, ends_at = $2 WHERE thread_id = $1`, [id, new Date(Date.now() + int(form.get('days'), 1, 7, 3) * 864e5)]);
  }
  await syncDisplay(id);
  redirect(safeBack(str(form.get('back')), `/forum/t/${id}`));
}

/** Seller: set how many are left. */
export async function setStock(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const left = int(form.get('left'), 0, 999, 0);
  await q('UPDATE listings SET quantity = sold_count + $3 WHERE thread_id = $1 AND seller_id = $2 AND mode IN ($4, $5)', [id, me.id, left, 'fixed', 'offers']);
  await syncDisplay(id);
  redirect(safeBack(str(form.get('back')), '/market?tab=listings'));
}

/* ---------- buying ---------- */

async function openDeal(d: {
  threadId: number; title: string; sellerId: number; buyerId: number; offerId?: number | null; source: 'buy' | 'offer' | 'auction';
  amount: number | null; shipCents: number | null; currency: string; quantity: number; method: Method; note?: string | null;
}) {
  const row = await one<{ id: number }>(
    `INSERT INTO deals (thread_id, title, seller_id, buyer_id, offer_id, source, amount_cents, ship_cents, currency, quantity, method, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [d.threadId, d.title, d.sellerId, d.buyerId, d.offerId ?? null, d.source, d.amount, d.method === 'ship' ? d.shipCents : null, d.currency, d.quantity, d.method, d.note ?? null],
  );
  return row!.id;
}

/** Take stock for a sale, atomically. False if there isn't enough left. */
async function claim(threadId: number, qty: number) {
  const row = await one('UPDATE listings SET sold_count = sold_count + $2 WHERE thread_id = $1 AND quantity - sold_count >= $2 RETURNING 1', [threadId, qty]);
  return !!row;
}

async function afterStockChange(threadId: number) {
  const l = await getListing(threadId);
  if (l && l.mode !== 'auction' && available(l) <= 0) {
    await q(`UPDATE offers SET status = 'expired', decided_at = now() WHERE listing_id = $1 AND kind = 'offer' AND status = 'pending'`, [threadId]);
  }
  await syncDisplay(threadId);
}

const pickMethod = (v: string, allowed: Method[]): Method => (allowed.includes(v as Method) ? (v as Method) : allowed[0] ?? 'meetup');

/** Buy at the listed price. It's a commitment: the deal opens straight away and the seller is told. */
export async function buy(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const path = `/forum/t/${id}`;
  const found = await liveListing(id);
  if (!found) redirect('/forum');
  const { t, l } = found!;
  if (l.mode !== 'fixed' || !l.price_cents) fail(path, 'Not for sale at a fixed price.');
  if (l.seller_id === me.id) fail(path, "That's your listing.");
  const st = await one<{ status: string | null }>('SELECT status FROM threads WHERE id = $1', [id]);
  if (st?.status === 'closed') fail(path, 'This listing is closed.');
  const qty = int(form.get('quantity'), 1, 999, 1);
  if (!(await claim(id, qty))) fail(path, qty > 1 ? 'Not enough left.' : 'Sold out.');
  const deal = await openDeal({
    threadId: id, title: t.title, sellerId: l.seller_id!, buyerId: me.id, source: 'buy',
    amount: l.price_cents! * qty, shipCents: l.ship_cents, currency: l.currency, quantity: qty,
    method: pickMethod(str(form.get('method')), methods(l)), note: str(form.get('note')).trim().slice(0, 300) || null,
  });
  await notify([{ kind: 'bought', ids: [l.seller_id] }], me.id, { threadId: id, dealId: deal });
  await afterStockChange(id);
  go('/market', 'ok', 'Deal opened. Arrange payment with the seller, then mark it paid.', `#d${deal}`);
}

/** Make an offer (money, a trade, or both). Replaces your earlier pending offer on the same listing. */
export async function makeOffer(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const path = `/forum/t/${id}`;
  const found = await liveListing(id);
  if (!found) redirect('/forum');
  const { l } = found!;
  if (!(l.mode === 'offers' || (l.mode === 'fixed' && l.accept_offers))) fail(path, 'Not taking offers.');
  if (l.seller_id === me.id) fail(path, "That's your listing.");
  if (available(l) <= 0) fail(path, 'Sold out.');
  const amount = toCents(str(form.get('amount')));
  const note = str(form.get('note')).trim().slice(0, 300) || null;
  if (!amount && !(l.trades && note)) fail(path, l.trades ? 'Add an amount, or describe the trade.' : 'Add an amount.');
  const qty = Math.min(int(form.get('quantity'), 1, 999, 1), available(l));
  await q(`UPDATE offers SET status = 'withdrawn', decided_at = now() WHERE listing_id = $1 AND buyer_id = $2 AND kind = 'offer' AND status = 'pending'`, [id, me.id]);
  await q(
    `INSERT INTO offers (listing_id, buyer_id, kind, amount_cents, quantity, method, note) VALUES ($1, $2, 'offer', $3, $4, $5, $6)`,
    [id, me.id, amount, qty, pickMethod(str(form.get('method')), methods(l)), note],
  );
  await notify([{ kind: 'offer', ids: [l.seller_id] }], me.id, { threadId: id });
  go(path, 'ok', 'Offer sent.');
}

/** Seller: accept (opens a deal) or decline an offer. */
export async function respondOffer(form: FormData) {
  const me = await requireUser();
  const offerId = Number(form.get('offer'));
  const accept = str(form.get('do')) === 'accept';
  const o = await one<{ id: number; listing_id: number; buyer_id: number | null; amount_cents: number | null; quantity: number; method: Method | null; note: string | null; status: string }>(
    `SELECT * FROM offers WHERE id = $1 AND kind = 'offer'`, [offerId],
  );
  const back = safeBack(str(form.get('back')), '/market');
  if (!o || o.status !== 'pending') fail(back, 'That offer is no longer open.');
  const found = await liveListing(o!.listing_id);
  if (!found || found.l.seller_id !== me.id) redirect('/market');
  const { t, l } = found!;
  if (!accept) {
    await q(`UPDATE offers SET status = 'declined', decided_at = now() WHERE id = $1`, [o!.id]);
    await notify([{ kind: 'offer_declined', ids: [o!.buyer_id] }], me.id, { threadId: t.id });
    go(back, 'ok', 'Declined.');
  }
  if (!o!.buyer_id) fail(back, 'That member is gone.');
  if (!(await claim(t.id, o!.quantity))) fail(back, 'Not enough left to accept this.');
  const deal = await openDeal({
    threadId: t.id, title: t.title, sellerId: me.id, buyerId: o!.buyer_id!, offerId: o!.id, source: 'offer',
    amount: o!.amount_cents, shipCents: l.ship_cents, currency: l.currency, quantity: o!.quantity,
    method: pickMethod(o!.method ?? '', methods(l)), note: o!.note,
  });
  await q(`UPDATE offers SET status = 'accepted', decided_at = now() WHERE id = $1`, [o!.id]);
  await notify([{ kind: 'offer_accepted', ids: [o!.buyer_id] }], me.id, { threadId: t.id, dealId: deal });
  await afterStockChange(t.id);
  go('/market', 'ok', 'Accepted. The deal is open.', `#d${deal}`);
}

export async function withdrawOffer(form: FormData) {
  const me = await requireUser();
  await q(`UPDATE offers SET status = 'withdrawn', decided_at = now() WHERE id = $1 AND buyer_id = $2 AND kind = 'offer' AND status = 'pending'`, [Number(form.get('offer')), me.id]);
  redirect(safeBack(str(form.get('back')), '/market?tab=offers'));
}

/** Bid on an auction. Bids are binding; late bids extend the clock. */
export async function placeBid(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const path = `/forum/t/${id}`;
  await settleAuctions(true);
  const found = await liveListing(id);
  if (!found) redirect('/forum');
  const { l } = found!;
  if (!auctionOpen(l)) fail(path, 'This auction has ended.');
  if (l.seller_id === me.id) fail(path, "You can't bid on your own auction.");
  if (l.min_deals > 0) {
    const rep = await reputation(me.id);
    if (rep.sold + rep.bought < l.min_deals) fail(path, `Bidding here needs ${l.min_deals} completed ${l.min_deals === 1 ? 'deal' : 'deals'}.`);
  }
  const [top] = await bidsFor(id, 1);
  const min = nextBid(l, top?.amount_cents ?? null);
  const amount = toCents(str(form.get('amount')));
  if (!amount || amount < min) fail(path, `Bid at least ${money(min, l.currency)}.`);
  await q(
    `INSERT INTO offers (listing_id, buyer_id, kind, amount_cents, method, status) VALUES ($1, $2, 'bid', $3, $4, 'active')`,
    [id, me.id, amount, pickMethod(str(form.get('method')), methods(l))],
  );
  await extendIfLate(id, l.ends_at!);
  await notify([{ kind: 'bid', ids: [l.seller_id] }], me.id, { threadId: id });
  if (top?.buyer_id && top.buyer_id !== me.id) await notify([{ kind: 'outbid', ids: [top.buyer_id] }], me.id, { threadId: id });
  await syncDisplay(id);
  go(path, 'ok', `You're the high bidder at ${money(amount, l.currency)}.`);
}

/* ---------- deals ---------- */

type Deal = {
  id: number; thread_id: number | null; title: string; seller_id: number | null; buyer_id: number | null; source: string;
  status: DealStatus; method: Method; quantity: number; amount_cents: number | null; currency: string; cancel_reason: string | null;
  buyer_rating: string | null; seller_rating: string | null;
};

async function myDeal(form: FormData) {
  const me = await requireUser();
  const d = await one<Deal>('SELECT * FROM deals WHERE id = $1', [Number(form.get('id'))]);
  const role = !d ? null : d.buyer_id === me.id ? 'buyer' : d.seller_id === me.id ? 'seller' : null;
  if (!d || !role) redirect('/market');
  return { me, d: d!, role: role as 'buyer' | 'seller', other: role === 'buyer' ? d!.seller_id : d!.buyer_id };
}

/** Move a deal one step on (mark paid, confirm payment, shipped, received). */
export async function dealStep(form: FormData) {
  const { me, d, role, other } = await myDeal(form);
  const step = STEPS[d.method][d.status];
  if (!step || step.who !== role) fail('/market', 'Waiting on the other person.');
  const moved = await one(
    `UPDATE deals SET status = $3, ${step!.stamp} = now(), updated_at = now() WHERE id = $1 AND status = $2 RETURNING 1`,
    [d.id, d.status, step!.next],
  );
  if (moved) await notify([{ kind: `deal_${step!.next}` as NotifyKind, ids: [other] }], me.id, { dealId: d.id });
  redirect(`/market#d${d.id}`);
}

export async function cancelDeal(form: FormData) {
  const { me, d, role, other } = await myDeal(form);
  if (!canCancel(d.status, role)) fail('/market', "This deal can't be cancelled now.");
  const reasons = CANCEL_REASONS[role].map((r) => r.id as string);
  const reason = reasons.includes(str(form.get('reason'))) ? str(form.get('reason')) : 'other';
  const done = await one(
    `UPDATE deals SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3, updated_at = now()
      WHERE id = $1 AND status NOT IN ('complete', 'cancelled') RETURNING 1`,
    [d.id, me.id, reason],
  );
  if (done && d.thread_id && d.source !== 'auction') {
    await q('UPDATE listings SET sold_count = GREATEST(0, sold_count - $2) WHERE thread_id = $1', [d.thread_id, d.quantity]);
    await syncDisplay(d.thread_id);
  }
  if (done) await notify([{ kind: 'deal_cancelled', ids: [other] }], me.id, { dealId: d.id });
  redirect(`/market#d${d.id}`);
}

/** Auction winner didn't pay: offer the item to the next highest bidder at their bid. */
export async function secondChance(form: FormData) {
  const { me, d, role } = await myDeal(form);
  if (role !== 'seller' || d.source !== 'auction' || d.status !== 'cancelled' || !d.thread_id) fail('/market', 'Not available for this deal.');
  const open = await one(`SELECT 1 FROM deals WHERE thread_id = $1 AND status <> 'cancelled'`, [d.thread_id]);
  if (open) fail('/market', 'There is already an open deal for this item.');
  const l = await getListing(d.thread_id!);
  const next = await one<{ id: number; buyer_id: number; amount_cents: number; method: Method | null }>(
    `SELECT o.id, o.buyer_id, o.amount_cents, o.method FROM offers o
      WHERE o.listing_id = $1 AND o.kind = 'bid' AND o.buyer_id IS NOT NULL
        AND o.buyer_id NOT IN (SELECT buyer_id FROM deals WHERE thread_id = $1 AND buyer_id IS NOT NULL)
      ORDER BY o.amount_cents DESC, o.created_at ASC LIMIT 1`,
    [d.thread_id],
  );
  if (!next || !l) fail('/market', 'No other bidders.');
  const deal = await openDeal({
    threadId: d.thread_id!, title: d.title, sellerId: me.id, buyerId: next!.buyer_id, offerId: next!.id, source: 'auction',
    amount: next!.amount_cents, shipCents: l!.ship_cents, currency: l!.currency, quantity: 1, method: pickMethod(next!.method ?? '', methods(l!)),
  });
  await notify([{ kind: 'second_chance', ids: [next!.buyer_id] }], me.id, { threadId: d.thread_id, dealId: deal });
  go('/market', 'ok', 'Offered to the next bidder.', `#d${deal}`);
}

export async function leaveFeedback(form: FormData) {
  const { d, role } = await myDeal(form);
  if (d.status !== 'complete') fail('/market', 'Feedback opens once the deal is complete.');
  const rating = str(form.get('rating')) === 'bad' ? 'bad' : 'good';
  const note = str(form.get('note')).trim().slice(0, 140) || null;
  const col = role === 'buyer' ? 'buyer' : 'seller';
  await q(`UPDATE deals SET ${col}_rating = $2, ${col}_note = $3 WHERE id = $1 AND ${col}_rating IS NULL`, [d.id, rating, note]);
  redirect(`/market?tab=history#d${d.id}`);
}
