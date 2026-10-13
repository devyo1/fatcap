import Link from 'next/link';
import { left } from '@/lib/format';
import { mediaUrl } from '@/lib/media-token';
import { subBySlug } from '@/lib/config';
import type { ThreadRow } from './ThreadRows';

/** How it changes hands, short: "Ships", "Plateau", "Ships / Plateau". */
function handover(t: ThreadRow) {
  const ways = [t.ships ? 'Ships' : '', t.meetup ? (t.meetup_area || 'Meetup') : ''].filter(Boolean);
  return ways.join(' / ');
}

/** Market threads as cards: the photo, the price, what it is, who's selling and how it changes hands. */
export default function ListingGrid({ rows, empty, showTopic = false }: { rows: ThreadRow[]; empty: string; showTopic?: boolean }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="listings">
      {rows.map((t) => {
        const sold = t.status === 'sold' || t.status === 'ended' || t.status === 'closed';
        const tag = t.status === 'sold' ? 'Sold' : t.status === 'ended' ? 'Ended' : t.status === 'closed' ? 'Closed' : t.auction_ends ? `Auction / ${left(t.auction_ends)}` : t.mode === 'wanted' ? 'Wanted' : null;
        const how = handover(t);
        return (
          <li key={t.id}>
            <Link className={`listing${sold ? ' sold' : ''}${t.unread ? ' unread' : ''}`} href={`/forum/t/${t.id}`}>
              <span className="cover">
                {t.cover
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`${mediaUrl(t.cover)}?w=480`} alt="" loading="lazy" decoding="async" />
                  : <span className="cover-blank" aria-hidden="true" />}
                {tag && <span className={`cover-tag mono${sold ? '' : ' live'}`}>{tag}</span>}
              </span>
              <span className="l-price">{t.price || 'Offers'}</span>
              <span className="l-title">{t.title}</span>
              <span className="l-meta mono">
                <span>{t.author ?? 'gone'}</span>
                {showTopic && t.topic && <span>{subBySlug(t.board, t.topic)?.name}</span>}
                {how && <span>{how}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
