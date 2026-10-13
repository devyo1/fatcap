'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Full-screen viewer for pictures in posts and chat. Click (or tap) one to open; arrows / swipe
 * to move through the others in the same post; Esc, a tap outside, or a swipe down closes.
 */
export default function Lightbox() {
  const [view, setView] = useState<{ list: string[]; i: number } | null>(null);
  // A drag in progress: which way it's going decides whether it pages (sideways) or closes (down).
  const touch = useRef<{ x: number; y: number; dx: number; dy: number; axis: '' | 'x' | 'y' } | null>(null);
  const [pull, setPull] = useState(0);

  const close = useCallback(() => { setView(null); setPull(0); }, []);
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
  const p = Math.min(pull, 320);
  return (
    <div
      className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={close}
      style={p ? { background: `rgba(8,8,7,${(0.95 - p / 520).toFixed(3)})` } : undefined}
      onTouchStart={(e) => {
        touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, dy: 0, axis: '' } : null;
      }}
      onTouchMove={(e) => {
        const t = touch.current;
        if (!t || e.touches.length !== 1) { touch.current = null; setPull(0); return; }
        t.dx = e.touches[0].clientX - t.x; t.dy = e.touches[0].clientY - t.y;
        if (!t.axis && Math.hypot(t.dx, t.dy) > 10) t.axis = Math.abs(t.dx) > Math.abs(t.dy) ? 'x' : 'y';
        if (t.axis === 'y') setPull(Math.max(0, t.dy));
      }}
      onTouchEnd={() => {
        const t = touch.current; touch.current = null;
        if (t?.axis === 'x' && Math.abs(t.dx) > 50) step(t.dx < 0 ? 1 : -1);
        if (t?.axis === 'y' && t.dy > 110) close();
        else setPull(0);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={view.list[view.i]} src={view.list[view.i]} alt="" onClick={(e) => { e.stopPropagation(); if (many) step(1); }}
        style={p ? { transform: `translateY(${p}px) scale(${(1 - p / 1600).toFixed(3)})`, transition: 'none', animation: 'none' } : undefined}
      />
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
