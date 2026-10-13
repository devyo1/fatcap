'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BOARDS, LIMITS, type Sub } from '@/lib/config';
import { CURRENCIES } from '@/lib/money';
import Writer from './Writer';
import VanishPicker from './VanishPicker';

export type ListingDefaults = {
  place?: string; title?: string; body?: string; mode?: string; currency?: string; price?: string; start?: string;
  quantity?: number; accept_offers?: boolean; ships?: boolean; ship_cost?: string; ship_note?: string;
  meetup?: boolean; meetup_area?: string; trades?: boolean; increment?: string; days?: number; min_deals?: number; expires?: string | null;
};

const MODES = [
  { id: 'fixed', name: 'Fixed price', hint: 'Buyers commit at your price.' },
  { id: 'offers', name: 'Offers', hint: 'Name an asking price, or none. You pick an offer.' },
  { id: 'auction', name: 'Auction', hint: 'Highest bid when the clock runs out. Bids are binding.' },
] as const;
const DAYS = [1, 3, 5, 7];
const TRUST = [{ v: 0, label: 'Anyone' }, { v: 1, label: '1+ completed deal' }, { v: 3, label: '3+ completed deals' }, { v: 5, label: '5+ completed deals' }];

/**
 * New / edit listing. The fields follow the choices: fixed price, offers or auction; shipping
 * and/or meetup; Wanted posts only take a budget. `frozen`: an auction with bids, where only the
 * text and delivery can still change (the locked values ride along as hidden fields).
 */
export default function ListingForm({ action, defaults = {}, id, frozen = false, cancelHref, submit }: {
  action: (form: FormData) => void | Promise<void>; defaults?: ListingDefaults; id?: number; frozen?: boolean; cancelHref: string; submit: string;
}) {
  const market = BOARDS.find((b) => b.market)!;
  const [place, setPlace] = useState(defaults.place ?? '');
  const [mode, setMode] = useState(defaults.mode ?? 'fixed');
  const [ships, setShips] = useState(defaults.ships ?? true);
  const [meetup, setMeetup] = useState(defaults.meetup ?? false);
  const wanted = place.endsWith('/wanted');
  const m = wanted ? 'wanted' : mode;

  return (
    <form action={action} className="stack compose-form listing-form">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="field-row">
        <div className="field">
          <label className="mono" htmlFor="place">Section</label>
          <select className="input select" id="place" name="place" required value={place} onChange={(e) => setPlace(e.target.value)}>
            <option value="" disabled>Select</option>
            {(market.subs as readonly Sub[]).map((s) => <option key={s.slug} value={`${market.slug}/${s.slug}`}>{market.name} / {s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="mono" htmlFor="title">{wanted ? 'Looking for' : 'Title'}</label>
        <input data-draft className="input big" id="title" name="title" maxLength={LIMITS.title} required autoComplete="off" defaultValue={defaults.title} />
      </div>

      {!wanted && (
        <fieldset className="choice" disabled={frozen}>
          <legend className="mono mute">How it sells</legend>
          <div className="choice-row">
            {MODES.map((o) => (
              <label key={o.id} className={`choice-opt${mode === o.id ? ' on' : ''}`}>
                <input type="radio" name={frozen ? undefined : 'mode'} value={o.id} checked={mode === o.id} onChange={() => setMode(o.id)} />
                <b>{o.name}</b>
                <span className="mute">{o.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {frozen && (
        <>
          <input type="hidden" name="mode" value="auction" />
          <input type="hidden" name="start" value={defaults.start ?? ''} />
          <input type="hidden" name="currency" value={defaults.currency ?? 'CAD'} />
          <input type="hidden" name="increment" value={defaults.increment ?? ''} />
          <input type="hidden" name="min_deals" value={defaults.min_deals ?? 0} />
          <p className="hint mono">Bids are in: price and timing are locked.</p>
        </>
      )}

      {!frozen && (
        <div className="field-row">
          {m === 'auction' ? (
            <div className="field">
              <label className="mono" htmlFor="start">Starting bid</label>
              <input className="input" id="start" name="start" inputMode="decimal" placeholder="0" defaultValue={defaults.start} required />
            </div>
          ) : (
            <div className="field">
              <label className="mono" htmlFor="price">{m === 'wanted' ? 'Budget (optional)' : m === 'offers' ? 'Asking (optional)' : 'Price'}</label>
              <input className="input" id="price" name="price" inputMode="decimal" placeholder="0" defaultValue={defaults.price} required={m === 'fixed'} />
            </div>
          )}
          <div className="field">
            <label className="mono" htmlFor="currency">Currency</label>
            <select className="input select" id="currency" name="currency" defaultValue={defaults.currency ?? 'CAD'}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {(m === 'fixed' || m === 'offers') && (
            <div className="field">
              <label className="mono" htmlFor="quantity">In stock</label>
              <input className="input" id="quantity" name="quantity" type="number" inputMode="numeric" min={1} max={999} defaultValue={defaults.quantity ?? 1} />
            </div>
          )}
        </div>
      )}
      {!frozen && m === 'fixed' && (
        <label className="check mono"><input type="checkbox" name="accept_offers" defaultChecked={defaults.accept_offers} /> Also take offers</label>
      )}
      {!frozen && m === 'auction' && (
        <div className="field-row">
          <div className="field">
            <label className="mono" htmlFor="days">Runs for</label>
            <select className="input select" id="days" name="days" defaultValue={String(defaults.days ?? 3)}>
              {DAYS.map((d) => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="mono" htmlFor="increment">Minimum raise</label>
            <input className="input" id="increment" name="increment" inputMode="decimal" placeholder="1" defaultValue={defaults.increment} />
          </div>
          <div className="field">
            <label className="mono" htmlFor="min_deals">Who can bid</label>
            <select className="input select" id="min_deals" name="min_deals" defaultValue={String(defaults.min_deals ?? 0)}>
              {TRUST.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {m !== 'wanted' && (
        <fieldset className="choice">
          <legend className="mono mute">Delivery</legend>
          <label className="check mono"><input type="checkbox" name="ships" checked={ships} onChange={(e) => setShips(e.target.checked)} /> Shipping</label>
          {ships && (
            <div className="field-row indent">
              <div className="field"><label className="mono" htmlFor="ship_cost">Shipping cost (optional)</label><input className="input" id="ship_cost" name="ship_cost" inputMode="decimal" placeholder="Included" defaultValue={defaults.ship_cost} /></div>
              <div className="field"><label className="mono" htmlFor="ship_note">Ships to</label><input className="input" id="ship_note" name="ship_note" maxLength={80} placeholder="Canada, US" defaultValue={defaults.ship_note} /></div>
            </div>
          )}
          <label className="check mono"><input type="checkbox" name="meetup" checked={meetup} onChange={(e) => setMeetup(e.target.checked)} /> Meetup</label>
          {meetup && (
            <div className="field indent"><label className="mono" htmlFor="meetup_area">Area</label><input className="input" id="meetup_area" name="meetup_area" maxLength={60} placeholder="Neighbourhood, not an address" defaultValue={defaults.meetup_area} /></div>
          )}
          <label className="check mono"><input type="checkbox" name="trades" defaultChecked={defaults.trades} /> Open to trades</label>
        </fieldset>
      )}

      <div className="field">
        <label className="mono" htmlFor="body">Details</label>
        <Writer id="body" rows={7} maxLength={LIMITS.body} defaultValue={defaults.body} draft={!id} />
        <span className="hint mono">First image is the cover. Printed zines: add sample pages after it, in order. (Making one to read here? Pick Zine or book at the top.)</span>
      </div>
      <div className="field">
        <label className="mono" htmlFor="vanish">Vanish</label>
        <VanishPicker id="vanish" editing={!!id} current={defaults.expires} />
      </div>
      <div className="actions">
        <button className="btn solid" type="submit">{submit}</button>
        <Link className="mono mute" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
