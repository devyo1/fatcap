'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RichText from './RichText';

/**
 * A page: a picture (filling the page, or whole on paper, with an optional caption), a page of
 * text, or (on a paid zine you haven't bought) the page that says how many more there are.
 */
export type ZinePage =
  | { kind?: 'image'; src: string; w: number; h: number; fit?: 'cover' | 'contain'; caption?: string }
  | { kind: 'text'; body: string }
  | { kind: 'locked'; more: number; href: string; price?: string };

const Lock = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);
type Turn = { dir: 1 | -1; to: number };

const TURN_MS = 700;

/**
 * Reads a zine's pictures like the object: cover alone, then two-page spreads that turn on the
 * spine (single pages on narrow screens). Tap or click the right / left side, swipe, or use the
 * arrow keys. Thumbnails jump; the expand button opens it full screen.
 */
export default function ZineViewer({ pages, title, ratio: shape }: { pages: ZinePage[]; title: string; ratio?: number }) {
  const [wide, setWide] = useState(false);
  const [page, setPage] = useState(0); // first page of the current view
  const [turn, setTurn] = useState<Turn | null>(null);
  const [big, setBig] = useState(false);
  const touch = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 760px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Each view is a list of page indexes; -1 is a blank page (left of the cover, end of the zine).
  const views = useMemo(() => {
    if (!wide) return pages.map((_, i) => [i]);
    const v: number[][] = [[-1, 0]];
    for (let i = 1; i < pages.length; i += 2) v.push([i, i + 1 < pages.length ? i + 1 : -1]);
    return v;
  }, [wide, pages]);
  const at = Math.max(0, views.findIndex((v) => v.includes(page)));
  const view = views[at];

  const go = useCallback((dir: 1 | -1) => {
    if (turn) return;
    const to = at + dir;
    if (to < 0 || to >= views.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setPage(views[to].find((i) => i >= 0) ?? 0); return; }
    setTurn({ dir, to });
  }, [at, turn, views]);

  const land = useCallback(() => {
    if (!turn) return;
    setPage(views[turn.to].find((i) => i >= 0) ?? 0);
    setTurn(null);
  }, [turn, views]);

  // Safety net in case animationend doesn't fire (tab hidden mid-turn).
  useEffect(() => {
    if (!turn) return;
    const t = setTimeout(land, TURN_MS + 150);
    return () => clearTimeout(t);
  }, [turn, land]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!big && !root.current?.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') setBig(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, big]);

  useEffect(() => {
    if (!big) return;
    const html = document.documentElement, before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = before; };
  }, [big]);

  const img = (i: number | undefined) => {
    const p = i == null || i < 0 ? undefined : pages[i];
    if (!p) return <span className="zv-blank" />;
    if (p.kind === 'text') return <div className="zv-text"><RichText text={p.body} className="zv-body" /></div>;
    if (p.kind === 'locked') {
      return (
        <div className="zv-locked">
          <Lock />
          <b>{p.more} more {p.more === 1 ? 'page' : 'pages'}</b>
          <a className="btn solid small" href={p.href} onClick={(e) => e.stopPropagation()}>{p.price ? `Get it, ${p.price}` : 'Get it'}</a>
        </div>
      );
    }
    return (
      <figure className={`zv-pic ${p.fit ?? 'cover'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt={i === 0 ? `${title}, cover` : `${title}, page ${i! + 1}`} draggable={false} />
        {p.caption && <figcaption className="mono">{p.caption}</figcaption>}
      </figure>
    );
  };

  // What sits underneath while a leaf turns, and what's printed on each side of the leaf.
  const target = turn ? views[turn.to] : view;
  let base: number[], front: number | undefined, back: number | undefined;
  if (!turn) base = view;
  else if (wide) {
    base = turn.dir === 1 ? [view[0], target[1]] : [target[0], view[1]];
    front = turn.dir === 1 ? view[1] : view[0];
    back = turn.dir === 1 ? target[0] : target[1];
  } else {
    base = turn.dir === 1 ? target : view;
    front = turn.dir === 1 ? view[0] : target[0];
  }

  const first = pages[0];
  const ratio = shape ?? (first && (!first.kind || first.kind === 'image') && first.w && first.h ? first.w / first.h : 3 / 4);
  const label = wide
    ? view.filter((i) => i >= 0).map((i) => (i === 0 ? 'Cover' : i + 1)).join('-')
    : page === 0 ? 'Cover' : String(page + 1);

  return (
    <div
      ref={root} className={`zv${big ? ' big' : ''}`} tabIndex={0} aria-roledescription="zine viewer" aria-label={`${title}: ${pages.length} pages`}
      onClick={(e) => { if (big && e.target === e.currentTarget) setBig(false); }}
    >
      <div
        className={`zv-book${wide ? ' spread' : ''}`}
        style={{ ['--ratio' as string]: String(wide ? ratio * 2 : ratio) }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          go(e.clientX - r.left > r.width / 2 ? 1 : -1);
        }}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const x = touch.current; touch.current = null;
          if (x == null) return;
          const dx = e.changedTouches[0].clientX - x;
          if (Math.abs(dx) > 40) { e.preventDefault(); go(dx < 0 ? 1 : -1); }
        }}
      >
        {base.map((i, k) => (
          <div key={`b${k}`} className={`zv-page${wide ? (k === 0 ? ' l' : ' r') : ''}`}>{img(i)}</div>
        ))}
        {turn && (
          <div
            className={`zv-leaf ${turn.dir === 1 ? 'fwd' : 'back'}${wide ? ' half' : ''}`}
            style={{ animationDuration: `${TURN_MS}ms` }}
            onAnimationEnd={land}
          >
            <div className="zv-face f">{img(front)}</div>
            <div className="zv-face b">{wide ? img(back) : <span className="zv-blank" />}</div>
          </div>
        )}
        {wide && <span className="zv-spine" aria-hidden="true" />}
      </div>

      <div className="zv-bar mono">
        <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label="Previous page">&larr;</button>
        <span>{label} <span className="mute">/ {pages.length}</span></span>
        <button type="button" onClick={() => go(1)} disabled={at >= views.length - 1} aria-label="Next page">&rarr;</button>
        <button type="button" className="zv-expand" onClick={() => setBig((b) => !b)} aria-label={big ? 'Close' : 'Full screen'}>{big ? '×' : '⤢'}</button>
      </div>
      <div className="zv-thumbs" role="tablist" aria-label="Pages">
        {pages.map((p, i) => (
          <button
            key={i} type="button" role="tab" aria-selected={view.includes(i)} aria-label={i === 0 ? 'Cover' : `Page ${i + 1}`}
            className={view.includes(i) ? 'on' : ''} onClick={() => { if (!turn) setPage(i); }}
          >
            {p.kind === 'text' ? <span className="zv-thumb-text" aria-hidden="true">Aa</span>
              : p.kind === 'locked' ? <span className="zv-thumb-lock" aria-hidden="true"><Lock /></span>
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={p.src} alt="" loading="lazy" />}
          </button>
        ))}
      </div>
    </div>
  );
}
