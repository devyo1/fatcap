import Link from 'next/link';
import { ago, left } from '@/lib/format';
import { boardBySlug, subBySlug } from '@/lib/config';
import Avatar from './Avatar';
import { mediaUrl } from '@/lib/media-token';
import { Hourglass, Pin, Lock, Heart, Gavel, Bubble } from './Icons';

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
  excerpt?: string | null;
  ships?: boolean | null;
  meetup?: boolean | null;
  meetup_area?: string | null;
  format?: string | null;
  // card view only
  text?: string | null;
  pics?: { id: string; w: number; h: number; a: boolean; c?: string | null }[] | null;
  pic_count?: number;
  mine?: boolean;
  saved?: boolean;
  following?: boolean;
  last_comment?: { author: string | null; body: string } | null;
};

/** First words of a post for a list: markdown marks and links trimmed. */
export const preview = (s: string | null | undefined) =>
  (s ?? '').replace(/https?:\/\/\S+/g, '').replace(/(^|\s)(#{1,3}|>|-{3,}|[-*] |\d{1,2}[.)] )/g, ' ').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();

/** Little markers shared by rows and listing cards: pinned, locked, auction clock, vanishing. */
export function Marks({ t }: { t: ThreadRow }) {
  return (
    <>
      {t.pinned && <span className="mark" title="Pinned"><Pin /></span>}
      {t.locked && <span className="mark" title="Locked"><Lock /></span>}
      {t.auction_ends && <span className="mark auction" title="Auction, time left"><Gavel />{left(t.auction_ends)}</span>}
      {t.expires_at && <span className="mark vanish" title="Deletes itself"><Hourglass />{left(t.expires_at)}</span>}
    </>
  );
}

/** Likes, and on phones (where the comments column is gone) the comment count. */
export function Counts({ t, comments = true }: { t: ThreadRow; comments?: boolean }) {
  return (
    <>
      {t.props ? <span className="mark" title={`${t.props} ${t.props === 1 ? 'like' : 'likes'}`}><Heart />{t.props}</span> : null}
      {comments && <span className="mark phone-only" title="Comments"><Bubble />{t.reply_count}</span>}
    </>
  );
}

/** "Board / Sub", where the board half drops off on phones. */
function Place({ board, topic }: { board: string; topic?: string | null }) {
  const b = boardBySlug(board)?.name ?? board;
  const s = subBySlug(board, topic)?.name;
  return <span className="board-tag">{s ? <><span className="hide-phone">{b} / </span>{s}</> : b}</span>;
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
              {preview(t.excerpt) && <span className="ex">{preview(t.excerpt)}</span>}
              <span className="m mono">
                <span className="m-a">
                  {showBoard && <Place board={t.board} topic={t.topic} />}
                  {showTopic && t.topic && <span className="board-tag">{subBySlug(t.board, t.topic)?.name}</span>}
                  <span>{t.author ?? 'gone'}</span>
                  <span title={t.last_author && t.reply_count > 0 ? `Last comment by ${t.last_author}` : undefined}>{ago(t.last_post_at)}</span>
                  {t.price && <span className={`price${t.status === 'sold' || t.status === 'ended' || t.status === 'closed' ? ' sold' : ''}`}>{t.status === 'sold' ? 'Sold' : t.status === 'ended' ? 'Ended' : t.status === 'closed' ? 'Closed' : t.price}</span>}
                  <Marks t={t} />
                </span>
                <span className="m-n"><Counts t={t} /></span>
              </span>
            </span>
            {t.cover && (
              <span className="thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${mediaUrl(t.cover)}?w=240&sq=1`} alt="" loading="lazy" decoding="async" />
              </span>
            )}
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
