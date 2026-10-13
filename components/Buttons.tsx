'use client';

import { useEffect, useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn small"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch {}
      }}
    >
      {done ? 'Copied' : 'Copy link'}
    </button>
  );
}

/** The phone's share sheet, where there is one. */
export function ShareButton({ url }: { url: string }) {
  const [can, setCan] = useState(false);
  useEffect(() => setCan(typeof navigator !== 'undefined' && 'share' in navigator), []);
  if (!can) return null;
  return (
    <button type="button" className="btn small" onClick={() => navigator.share({ url }).catch(() => {})}>
      Share
    </button>
  );
}

export function PrintButton() {
  return <button type="button" className="btn solid" onClick={() => window.print()}>Print sheet</button>;
}
