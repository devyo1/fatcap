'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptics';

const ARM = 72; // pull this far (px) and let go to refresh
const MAX = 120;
const HOLD = 64; // where the page rests while it refreshes
const MIN_SPIN = 650; // even a fast refresh gets a moment of spin
const DOTS = 10;

/**
 * Pull down from the top of any page to refresh it. The page slides down to show a ring of
 * halftone dots that fill in as you pull; past the line the brand dot pops (with a haptic tap),
 * let go and the ring spins while the page reloads its data, then everything springs back.
 */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'pulling' | 'armed' | 'refreshing' | 'done'>('idle');
  const g = useRef({ y0: 0, on: false, armed: false, busy: false, t0: 0 });

  useEffect(() => {
    const scrolledInside = (el: EventTarget | null) => {
      for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
        if (n.scrollTop > 0 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return true;
      }
      return false;
    };
    const start = (e: TouchEvent) => {
      const s = g.current;
      if (s.busy || e.touches.length !== 1 || window.scrollY > 0 || scrolledInside(e.target)) return;
      if ((e.target as HTMLElement).closest?.('textarea, input, select, [data-no-pull]')) return;
      s.y0 = e.touches[0].clientY; s.on = true; s.armed = false;
    };
    const move = (e: TouchEvent) => {
      const s = g.current;
      if (!s.on) return;
      const dy = e.touches[0].clientY - s.y0;
      if (dy <= 0 || window.scrollY > 0) { setPull(0); setPhase('idle'); return; }
      if (e.cancelable) e.preventDefault(); // we're doing the overscroll now
      const p = MAX * (1 - Math.exp(-dy / (MAX * 1.4))); // rubber band
      setPull(p);
      if (p >= ARM && !s.armed) { s.armed = true; haptic(8); }
      else if (p < ARM && s.armed) s.armed = false;
      setPhase(s.armed ? 'armed' : 'pulling');
    };
    const end = () => {
      const s = g.current;
      if (!s.on) return;
      s.on = false;
      if (!s.armed) { setPull(0); setPhase('idle'); return; }
      s.busy = true;
      setPhase('refreshing');
      setPull(HOLD);
      haptic(14);
      s.t0 = Date.now();
      window.dispatchEvent(new Event('fc:refresh'));
      startTransition(() => router.refresh());
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [router]);

  // Keep spinning until the fresh data is in (and for at least MIN_SPIN), then spring back.
  useEffect(() => {
    if (phase !== 'refreshing' || pending) return;
    const s = g.current;
    const t = setTimeout(() => {
      setPhase('done');
      haptic(6);
      setTimeout(() => { setPull(0); setPhase('idle'); s.busy = false; }, 280);
    }, Math.max(0, MIN_SPIN - (Date.now() - s.t0)));
    return () => clearTimeout(t);
  }, [phase, pending]);

  const progress = Math.min(1, pull / ARM);
  const dragging = phase === 'pulling' || phase === 'armed';
  return (
    <>
      <div className={`ptr ${phase}`} style={{ height: pull }} aria-hidden={phase !== 'refreshing'} role="status">
        <div className="ptr-mark" style={dragging ? { opacity: Math.min(1, progress * 1.4), transform: `rotate(${progress * 180}deg) scale(${0.6 + progress * 0.4})` } : undefined}>
          {Array.from({ length: DOTS }, (_, i) => (
            <span key={i} className="ptr-dot" style={{ transform: `rotate(${(i * 360) / DOTS}deg) translateY(-15px)`, opacity: progress * DOTS > i ? 1 : 0.12 }} />
          ))}
          <span className="ptr-core" />
        </div>
        <span className="sr">{phase === 'refreshing' ? 'Refreshing' : ''}</span>
      </div>
      <div className={`ptr-page${dragging ? ' dragging' : ''}`} style={pull ? { transform: `translateY(${pull}px)` } : undefined}>
        {children}
      </div>
    </>
  );
}
