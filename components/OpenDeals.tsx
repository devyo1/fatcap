import Link from 'next/link';
import type { OpenDeal } from '@/lib/market';

/** Deals still in motion, pinned to the top of the market so nothing gets left hanging. */
export default function OpenDeals({ deals, offers }: { deals: OpenDeal[]; offers: number }) {
  if (!deals.length && !offers) return null;
  const waiting = deals.filter((d) => d.next).length + offers;
  const shown = deals.slice(0, offers ? 2 : 3);
  const more = deals.length - shown.length;
  return (
    <section className="open-deals" aria-label="Your open deals">
      <div className="od-head mono">
        <span><span className="br">Open deals</span> <span className="mute">{deals.length}</span></span>
        {waiting > 0 && <span className="od-wait">{waiting} {waiting === 1 ? 'needs' : 'need'} you</span>}
        <Link href="/market">{more > 0 ? `+${more} more` : 'All'} &rarr;</Link>
      </div>
      <ul>
        {offers > 0 && (
          <li className="turn">
            <Link href="/market">
              <span className="pill mono on">Offers</span>
              <span className="od-t">{offers} {offers === 1 ? 'offer' : 'offers'} to answer</span>
              <span className="od-s mono">Answer</span>
            </Link>
          </li>
        )}
        {shown.map((d) => (
          <li key={d.id} className={d.next ? 'turn' : undefined}>
            <Link href={`/market#d${d.id}`}>
              <span className={`pill mono${d.next ? ' on' : ''}`}>{d.role === 'seller' ? 'Selling' : 'Buying'}</span>
              <span className="od-t">{d.title}</span>
              <span className="od-s mono">{d.next ?? <>Waiting<span className="hide-phone"> on {d.other ?? 'them'}</span></>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
