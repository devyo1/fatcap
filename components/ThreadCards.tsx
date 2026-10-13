'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ago, left } from '@/lib/format';
import { boardBySlug, subBySlug } from '@/lib/config';
import { mediaUrl } from '@/lib/media-token';
import Avatar from './Avatar';
import { squareAttrs } from './RichText';
import { Quote } from './Poster';
import { preview, type ThreadRow } from './ThreadRows';
import { useLike, FollowButton, SaveButton } from './Toggles';
import { Heart, Bubble, Hourglass, Gavel } from './Icons';
import { haptic } from '@/lib/haptics';

const TAP = 280; // two taps closer than this are a double tap

const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2 7 9M14 2l-4.5 12L7 9 2 6.5z" />
  </svg>
);

/** The phone's share sheet for a thread, or copy its link. */
function Share({ href, title }: { href: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button" className="act" aria-label="Share"
      onClick={async () => {
        const url = `${window.location.origin}${href}`;
        try {
          if (navigator.share) await navigator.share({ url, title });
          else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
        } catch {}
      }}
    ><ShareIcon />{copied && <span>Copied</span>}</button>
  );
}

/**
 * The plate: the post's pictures (swipe through; a tap opens the viewer) or, without pictures,
 * its opening line as a pull quote (a tap opens the post). A double tap anywhere likes it.
 */
function Plate({ t, href, at, setAt, onDouble }: { t: ThreadRow; href: string; at: number; setAt: (n: number) => void; onDouble: () => void }) {
  const router = useRouter();
  const pics = t.pics ?? [];
  const [burst, setBurst] = useState(0);
  const last = useRef(0);
  const timer = useRef(0);
  const replay = useRef(false);
  const closed = t.status === 'sold' || t.status === 'ended' || t.status === 'closed';

  const onClick = (e: React.MouseEvent) => {
    if (replay.current) { replay.current = false; return; } // our own click, passed on to the viewer
    // Held back to tell a tap from a double tap; nothing else on the page should act on it.
    e.preventDefault();
    e.stopPropagation();
    const a = (e.target as Element).closest('a');
    const now = Date.now();
    if (now - last.current < TAP) {
      clearTimeout(timer.current);
      last.current = 0;
      onDouble();
      setBurst((b) => b + 1);
      return;
    }
    last.current = now;
    timer.current = window.setTimeout(() => {
      last.current = 0;
      if (a?.classList.contains('pic')) { replay.current = true; a.click(); }
      else router.push(href);
    }, TAP);
  };

  return (
    <div className="frame" onClick={onClick}>
      {pics.length ? (
        <div className="frame-track" data-no-pull onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}>
          {pics.map((p, i) => (
            <a key={p.id} className="pic" href={mediaUrl(p.id)} target="_blank" rel="noopener" aria-label={pics.length > 1 ? `Picture ${i + 1} of ${pics.length}` : 'Picture'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...squareAttrs(p.id, { w: p.w, h: p.h, anim: p.a }, '(max-width: 900px) calc(100vw - 32px), 340px')} alt={p.c ?? ''} loading="lazy" decoding="async" draggable={false} />
            </a>
          ))}
        </div>
      ) : (
        <a className="frame-poster" href={href} aria-label={t.title}><Quote t={t} /></a>
      )}
      {(t.expires_at || t.auction_ends) && (
        <span className="frame-clock mono">
          {t.auction_ends ? <><Gavel />{left(t.auction_ends)}</> : <><Hourglass />{left(t.expires_at!)}</>}
        </span>
      )}
      {t.price && <span className={`frame-price${closed ? ' sold' : ''}`}>{t.status === 'sold' ? 'Sold' : closed ? 'Closed' : t.price}</span>}
      {burst > 0 && <span key={burst} className="frame-burst" aria-hidden="true"><Heart on /></span>}
      {pics.length > 1 && (
        <span className="frame-dots" aria-hidden="true">{pics.map((p, i) => <i key={p.id} className={i === at ? 'on' : ''} />)}</span>
      )}
    </div>
  );
}

function Print({ t, place }: { t: ThreadRow; place: boolean }) {
  const href = `/forum/t/${t.id}`;
  const who = t.author ? `/u/${encodeURIComponent(t.author)}` : null;
  const where = subBySlug(t.board, t.topic)?.name ?? boardBySlug(t.board)?.name ?? t.board;
  const pics = t.pics ?? [];
  const [at, setAt] = useState(0);
  const [on, flip] = useLike('thread', t.id, !!t.mine);
  const [pop, setPop] = useState(false);
  const likes = (t.props ?? 0) - (t.mine ? 1 : 0) + (on ? 1 : 0);
  const words = pics.length ? preview(t.text ?? t.excerpt ?? '') : '';
  const caption = pics[at]?.c;
  const last = t.last_comment && preview(t.last_comment.body) ? t.last_comment : null;
  const how = [t.ships ? 'Ships' : '', t.meetup ? (t.meetup_area || 'Meetup') : ''].filter(Boolean).join(' / ');
  return (
    <article className={`print${t.unread ? ' unread' : ''}`}>
      <div className="print-top mono">
        <span>{place ? <span className="br">{where}</span> : null}{t.pinned && <span className="pin">Pinned</span>}</span>
        <span>{t.unread && <span className="new" aria-label="New activity" />}{ago(t.created_at ?? t.last_post_at)}</span>
      </div>
      <div className="print-body">
        <figure className="print-plate">
          <div className="plate">
            <Plate t={t} href={href} at={at} setAt={setAt} onDouble={() => { if (!on) { setPop(true); flip(); } else haptic(6); }} />
          </div>
          {pics.length > 0 && (
            <figcaption className="print-fig mono">Fig. {at + 1}{pics.length > 1 ? `/${pics.length}` : ''}{caption ? <> &middot; {caption}</> : null}</figcaption>
          )}
        </figure>
        <div className="print-text">
          <h2 className="print-title"><Link href={href}>{t.title}</Link></h2>
          {words && <p className="print-lede">{words}</p>}
          {how && <p className="print-how mono">{how}</p>}
          <p className="print-by mono">
            {who ? <Link href={who}><Avatar name={t.author} size={18} /><span>{t.author}</span></Link> : <span>gone</span>}
          </p>
          <div className="acts print-acts">
            <button type="button" className={`act like${on ? ' on' : ''}${pop ? ' pop' : ''}`} aria-pressed={on} aria-label={on ? 'Unlike' : 'Like'} onClick={() => { setPop(!on); flip(); }} onAnimationEnd={() => setPop(false)}>
              <Heart on={on} /><span>{likes || 'Like'}</span>
            </button>
            <Link className="act" href={`${href}#comments`} aria-label={`${t.reply_count} comments`}><Bubble /><span>{t.reply_count || 'Comment'}</span></Link>
            <FollowButton id={t.id} following={!!t.following} />
            <SaveButton id={t.id} saved={!!t.saved} compact />
            <Share href={href} title={t.title} />
          </div>
          {last && <p className="print-last"><b>{last.author ?? 'gone'}</b> {preview(last.body)}</p>}
        </div>
      </div>
    </article>
  );
}

/**
 * Threads as prints, one after another: every post gets the same square plate (its pictures, or
 * its opening line as a pull quote), then the title, a few lines, the byline and all the usual
 * actions (like, comments, follow, save, share). On wide screens the plate swaps sides each time.
 */
export default function ThreadCards({ rows, empty, place = true }: { rows: ThreadRow[]; empty: string; place?: boolean }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="prints">
      {rows.map((t) => <li key={t.id}><Print t={t} place={place} /></li>)}
    </ul>
  );
}
