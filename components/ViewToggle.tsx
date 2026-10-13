'use client';

import { useOptimistic, useTransition } from 'react';
import { setLayout } from '@/app/browse-actions';
import type { Layout } from '@/lib/view';
import { haptic } from '@/lib/haptics';

const ListIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
const CardsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="16" height="8" rx="1" /><rect x="4" y="13.5" width="16" height="7" rx="1" /></svg>;

/** List (forum rows) or Cards (a social feed). Remembered on this device. */
export default function ViewToggle({ layout }: { layout: Layout }) {
  const [, start] = useTransition();
  const [shown, show] = useOptimistic(layout);
  const pick = (l: Layout) => {
    if (l === shown) return;
    haptic(6);
    start(async () => { show(l); await setLayout(l); });
  };
  return (
    <div className="view-toggle" role="group" aria-label="Layout">
      <button type="button" aria-pressed={shown === 'list'} aria-label="List" title="List" onClick={() => pick('list')}><ListIcon /></button>
      <button type="button" aria-pressed={shown === 'cards'} aria-label="Cards" title="Cards" onClick={() => pick('cards')}><CardsIcon /></button>
    </div>
  );
}
