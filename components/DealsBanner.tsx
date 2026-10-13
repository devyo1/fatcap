import Link from 'next/link';
import type { OpenDeal } from '@/lib/market';

/**
 * One line at the top of the Market when something is waiting on you (your step in a deal, or
 * offers to answer). Deals waiting on the other person live in Your market, not here.
 */
export default function DealsBanner({ deals, offers }: { deals: OpenDeal[]; offers: number }) {
  const due = deals.filter((d) => d.next);
  const n = due.length + offers;
  if (!n) return null;
  const first = due[0];
  const href = first ? `/market?deal=${first.id}` : '/market?tab=selling';
  return (
    <Link className="deals-banner" href={href}>
      <span className="db-dot" aria-hidden="true" />
      <span className="db-main">
        <b>{n === 1 ? '1 thing needs you' : `${n} things need you`}</b>
        <span className="db-sub">{first ? <>{first.next}: {first.title}</> : <>{offers} {offers === 1 ? 'offer' : 'offers'} to answer</>}</span>
      </span>
      <span className="db-go mono" aria-hidden="true">Open &rarr;</span>
    </Link>
  );
}
