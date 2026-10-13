import Link from 'next/link';
import { ago, left } from '@/lib/format';
import { placeName, subBySlug } from '@/lib/config';
import Avatar from './Avatar';
import { Hourglass, ImageIcon, Pin, Lock, Heart, Gavel } from './Icons';

export type ThreadRow = {
  id: number;
  title: string;
  board: string;
  topic?: string | null;
  author: string | null;
  reply_count: number;
  last_post_at: string;
  created_at?: string;
  pinned?: boolean;
  locked?: boolean;
  unread?: boolean;
  props?: number;
  last_author?: string | null;
  expires_at?: string | null;
  price?: string | null;
  status?: string | null;
  cover?: string | null;
  mode?: string | null;
  auction_ends?: string | null;
};

/** Little markers shared by rows and listing cards: pinned, locked, vanishing, has pictures. */
export function Marks({ t }: { t: ThreadRow }) {
  return (
    <>
      {t.pinned && <span className="mark" title="Pinned"><Pin /></span>}
      {t.locked && <span className="mark" title="Locked"><Lock /></span>}
      {t.auction_ends && <span className="mark auction" title="Auction, time left"><Gavel />{left(t.auction_ends)}</span>}
      {t.expires_at && <span className="mark vanish" title="Deletes itself"><Hourglass />{left(t.expires_at)}</span>}
      {t.cover && <span className="mark" title="Images"><ImageIcon /></span>}
      {t.props ? <span className="mark" title={`${t.props} ${t.props === 1 ? 'like' : 'likes'}`}><Heart />{t.props}</span> : null}
    </>
  );
}

/** `showBoard`: tag each row with "Board / Sub". `showTopic`: just the sub (on a board page). */
export default function ThreadRows({ rows, showBoard = false, showTopic = false, empty }: { rows: ThreadRow[]; showBoard?: boolean; showTopic?: boolean; empty: string }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="rows threads">
      {rows.map((t) => (
        <li key={t.id}>
          <Link className={`row trow${t.unread ? ' unread' : ''}`} href={`/forum/t/${t.id}`}>
            <Avatar name={t.author} size={36} />
            <span className="tb">
              <span className="t">
                {t.unread && <span className="new" aria-label="New activity" />}
                {t.title}
              </span>
              <span className="m mono">
                {showBoard && <span className="board-tag">{placeName(t.board, t.topic)}</span>}
                {showTopic && t.topic && <span className="board-tag">{subBySlug(t.board, t.topic)?.name}</span>}
                <span>{t.author ?? 'gone'}</span>
                <span title={t.last_author && t.reply_count > 0 ? `Last comment by ${t.last_author}` : undefined}>{ago(t.last_post_at)}</span>
                {t.price && <span className={`price${t.status === 'sold' || t.status === 'ended' || t.status === 'closed' ? ' sold' : ''}`}>{t.status === 'sold' ? 'Sold' : t.status === 'ended' ? 'Ended' : t.status === 'closed' ? 'Closed' : t.price}</span>}
                <Marks t={t} />
              </span>
            </span>
            <span className="stats-col mono">
              <b>{t.reply_count}</b>
              <span className="mute">{t.reply_count === 1 ? 'comment' : 'comments'}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
