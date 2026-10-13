'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Full-screen viewer for pictures in posts and chat. Click (or tap) one to open; arrows / swipe
 * to move through the others in the same post; Esc, a tap outside, or a swipe down closes.
 */
export default function Lightbox() {
  const [view, setView] = useState<{ list: string[]; i: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const close = useCallback(() => setView(null), []);
  const step = useCallback((d: number) => setView((v) => (v && v.list.length > 1 ? { ...v, i: (v.i + d + v.list.length) % v.list.length } : v)), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.('a.pic, a.cimg') as HTMLAnchorElement | null;
      if (!a) return;
      const scope = a.closest('.body, .cmsg-main') ?? a.parentElement ?? document.body;
      const list = [...scope.querySelectorAll<HTMLAnchorElement>('a.pic, a.cimg')].map((x) => x.href);
      e.preventDefault();
      setView({ list, i: Math.max(0, list.indexOf(a.href)) });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); html.style.overflow = before; };
  }, [view, close, step]);

  if (!view) return null;
  const many = view.list.length > 1;
  return (
    <div
      className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={close}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current; touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
        else if (dy > 90) close();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={view.list[view.i]} src={view.list[view.i]} alt="" onClick={(e) => { e.stopPropagation(); if (many) step(1); }} />
      <div className="lb-bar mono" onClick={(e) => e.stopPropagation()}>
        <span>{many ? `${view.i + 1} / ${view.list.length}` : ''}</span>
        <span className="lb-btns">
          {many && <button type="button" onClick={() => step(-1)} aria-label="Previous">&larr;</button>}
          {many && <button type="button" onClick={() => step(1)} aria-label="Next">&rarr;</button>}
          <button type="button" onClick={close} aria-label="Close">&times;</button>
        </span>
      </div>
    </div>
  );
}
