import Link from 'next/link';
import { left } from '@/lib/format';
import { squareAttrs } from './RichText';
import { Poster } from './Poster';
import type { ThreadRow } from './ThreadRows';
import { Heart, Bubble, Hourglass } from './Icons';

const Stack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <rect x="1.5" y="4.5" width="9" height="9" /><path d="M5 2.5h8.5V11" />
  </svg>
);

/**
 * Threads as a wall of square tiles, three across: a post's first picture (cropped square), or the
 * post as a poster. More pictures, a price or a vanishing clock show as small marks; a pointer
 * hovering a tile shows its title and counts.
 */
export default function ThreadGrid({ rows, empty }: { rows: ThreadRow[]; empty: string }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="wall">
      {rows.map((t) => {
        const pic = t.pics?.[0];
        const closed = t.status === 'sold' || t.status === 'ended' || t.status === 'closed';
        return (
          <li key={t.id}>
            <Link className={`wall-tile${pic ? ' photo' : ''}${t.unread ? ' unread' : ''}`} href={`/forum/t/${t.id}`} aria-label={t.title}>
              {pic
                // eslint-disable-next-line @next/next/no-img-element
                ? <img {...squareAttrs(pic.id, { w: pic.w, h: pic.h, anim: pic.a }, '(max-width: 760px) 34vw, 250px')} alt="" loading="lazy" decoding="async" />
                : <Poster t={t} small />}
              {(t.pic_count ?? 0) > 1 && <span className="wall-mark tr" title="More pictures"><Stack /></span>}
              {t.expires_at && <span className="wall-mark tl" title={`Vanishes in ${left(t.expires_at)}`}><Hourglass /></span>}
              {t.price && <span className={`wall-price${closed ? ' sold' : ''}`}>{t.status === 'sold' ? 'Sold' : closed ? 'Closed' : t.price}</span>}
              {t.unread && <span className="wall-new" aria-label="New activity" />}
              <span className="wall-over" aria-hidden="true">
                <span className="wall-t">{t.title}</span>
                <span className="wall-n mono"><Heart on /> {t.props ?? 0}<Bubble /> {t.reply_count}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
