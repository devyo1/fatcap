'use client';

import { useState } from 'react';

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

export function PrintButton() {
  return <button type="button" className="btn solid" onClick={() => window.print()}>Print sheet</button>;
}
