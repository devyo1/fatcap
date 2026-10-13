import Link from 'next/link';
import { mediaUrl } from '@/lib/media-token';
import { subBySlug } from '@/lib/config';
import type { ThreadRow } from './ThreadRows';
import { Marks, Counts } from './ThreadRows';

/** Market threads as cards: cover (the first picture in the post), title, price, seller. */
export default function ListingGrid({ rows, empty, showTopic = false }: { rows: ThreadRow[]; empty: string; showTopic?: boolean }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="listings">
      {rows.map((t) => {
        const sold = t.status === 'sold' || t.status === 'ended' || t.status === 'closed';
        const tag = t.status === 'sold' ? 'Sold' : t.status === 'ended' ? 'Ended' : t.status === 'closed' ? 'Closed' : t.auction_ends ? 'Auction' : null;
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
              <span className="l-title">{t.title}</span>
              <span className="l-meta mono">
                <span className="price">{t.price || '—'}</span>
                {showTopic && t.topic && <span>{subBySlug(t.board, t.topic)?.name}</span>}
                <span>{t.author ?? 'gone'}</span>
                <Marks t={t} />
                <Counts t={t} comments={false} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
