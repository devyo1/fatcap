'use client';

import { useEffect, useState } from 'react';

/** A hairline at the top that fills as you read a long post. */
export default function ReadingBar({ target }: { target: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight * 0.6;
        setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1);
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, [target]);
  return <div className="readbar" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />;
}
