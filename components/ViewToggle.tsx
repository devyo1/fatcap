'use client';

import { useOptimistic, useTransition } from 'react';
import { setLayout } from '@/app/browse-actions';
import type { Layout } from '@/lib/view';
import { haptic } from '@/lib/haptics';

const i = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true } as const;
const OPTIONS: { id: Layout; label: string; icon: React.ReactNode }[] = [
  { id: 'list', label: 'List', icon: <svg {...i} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg> },
  { id: 'cards', label: 'Cards', icon: <svg {...i}><rect x="5" y="3.5" width="14" height="14" /><path d="M5 20.5h9" strokeLinecap="round" /></svg> },
  { id: 'grid', label: 'Grid', icon: <svg {...i}><rect x="3.5" y="3.5" width="7" height="7" /><rect x="13.5" y="3.5" width="7" height="7" /><rect x="3.5" y="13.5" width="7" height="7" /><rect x="13.5" y="13.5" width="7" height="7" /></svg> },
];

/** List (the forum), Cards (one post at a time) or Grid (tiles). Remembered on this device. */
export default function ViewToggle({ layout }: { layout: Layout }) {
  const [, start] = useTransition();
  const [shown, show] = useOptimistic(layout);
  const pick = (l: Layout) => {
    if (l === shown) return;
    haptic(6);
    // The new layout plays a short entrance when it lands.
    const html = document.documentElement;
    html.dataset.switched = l;
    window.setTimeout(() => { if (html.dataset.switched === l) delete html.dataset.switched; }, 1600);
    start(async () => { show(l); await setLayout(l); });
  };
  const at = Math.max(0, OPTIONS.findIndex((o) => o.id === shown));
  return (
    <div className="view-switch" role="radiogroup" aria-label="Layout" style={{ '--at': at } as React.CSSProperties}>
      <span className="vs-thumb" aria-hidden="true" />
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={shown === o.id} title={o.label} onClick={() => pick(o.id)}>
          {o.icon}<span className="vs-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
