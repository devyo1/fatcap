import Link from 'next/link';
import { ago, left } from '@/lib/format';
import { boardBySlug, subBySlug } from '@/lib/config';
import { mediaUrl } from '@/lib/media-token';
import Avatar from './Avatar';
import RichText, { picAttrs } from './RichText';
import { preview, type ThreadRow } from './ThreadRows';
import { LikeButton, SaveButton } from './Toggles';
import { Bubble, Hourglass, Gavel, Pin } from './Icons';

const CLIP = 340;
const LINES = 6;

/** A post cut down for a card: a few lines, whole words. */
function clip(text: string) {
  let t = text.trim();
  let more = false;
  const lines = t.split('\n');
  if (lines.length > LINES) { t = lines.slice(0, LINES).join('\n').trim(); more = true; }
  if (t.length > CLIP) {
    const cut = t.slice(0, CLIP);
    t = cut.slice(0, Math.max(cut.lastIndexOf(' '), CLIP - 40)).trimEnd();
    more = true;
  }
  return more ? `${t}…` : t;
}

/** The post's pictures: one sized to itself (within portrait and wide limits), or a grid of up to four. */
function Media({ t }: { t: ThreadRow }) {
  const pics = t.pics ?? [];
  if (!pics.length) return null;
  const n = pics.length;
  const extra = Math.max(0, (t.pic_count ?? n) - n);
  const ratio = n === 1 ? Math.min(1.91, Math.max(0.8, pics[0].w / pics[0].h)) : undefined;
  return (
    <div className={`card-media n${n}`} style={ratio ? { aspectRatio: ratio.toFixed(3) } : undefined}>
      {pics.map((p, i) => (
        <a key={p.id} className="pic" href={mediaUrl(p.id)} target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...picAttrs(p.id, { w: p.w, h: p.h, anim: p.a }, n === 1 ? '(max-width: 760px) 100vw, 680px' : '(max-width: 760px) 50vw, 340px')}
            alt="" loading="lazy" decoding="async"
          />
          {i === n - 1 && extra > 0 && <span className="pic-more mono">+{extra}</span>}
        </a>
      ))}
    </div>
  );
}

function Card({ t, place }: { t: ThreadRow; place: boolean }) {
  const href = `/forum/t/${t.id}`;
  const who = t.author ? `/u/${encodeURIComponent(t.author)}` : null;
  const where = subBySlug(t.board, t.topic)?.name ?? boardBySlug(t.board)?.name ?? t.board;
  const closed = t.status === 'sold' || t.status === 'ended' || t.status === 'closed';
  const text = clip(t.text ?? '');
  const last = t.last_comment && preview(t.last_comment.body) ? t.last_comment : null;
  return (
    <article className={`card${t.unread ? ' unread' : ''}`}>
      <header className="card-head">
        {who ? <Link className="card-av" href={who} tabIndex={-1} aria-hidden="true"><Avatar name={t.author} size={38} /></Link> : <Avatar name={null} size={38} />}
        <span className="card-by">
          <span className="card-l1">
            {who ? <Link className="card-who" href={who}>{t.author}</Link> : <span className="card-who">gone</span>}
            <span className="mute"> · {ago(t.created_at ?? t.last_post_at)}</span>
          </span>
          <span className="card-l2 mono">
            {place && <span>{where}</span>}
            {t.pinned && <span className="mark" title="Pinned"><Pin /></span>}
            {t.auction_ends && <span className="mark auction" title="Auction, time left"><Gavel />{left(t.auction_ends)}</span>}
            {t.expires_at && <span className="mark vanish" title="Deletes itself"><Hourglass />{left(t.expires_at)}</span>}
          </span>
        </span>
        {t.price && <span className={`card-price${closed ? ' sold' : ''}`}>{t.status === 'sold' ? 'Sold' : t.status === 'ended' ? 'Ended' : t.status === 'closed' ? 'Closed' : t.price}</span>}
        {t.unread && <span className="new" aria-label="New activity" />}
      </header>
      <h2 className="card-title"><Link className="card-link" href={href}>{t.title}</Link></h2>
      {text && <RichText text={text} className="body card-text" />}
      <Media t={t} />
      <footer className="card-acts">
        <LikeButton target="thread" id={t.id} count={t.props ?? 0} mine={!!t.mine} />
        <Link className="act" href={`${href}#reply`} aria-label={`${t.reply_count} comments`}><Bubble /><span>{t.reply_count || 'Comment'}</span></Link>
        <SaveButton id={t.id} saved={!!t.saved} compact />
      </footer>
      {last && <p className="card-last"><b>{last.author ?? 'gone'}</b> {preview(last.body)}</p>}
    </article>
  );
}

/** Threads as social cards: who and when, the title, the start of the post, its pictures, likes. */
export default function ThreadCards({ rows, empty, place = true }: { rows: ThreadRow[]; empty: string; place?: boolean }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="cards">
      {rows.map((t) => <li key={t.id}><Card t={t} place={place} /></li>)}
    </ul>
  );
}
