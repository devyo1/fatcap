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

/**
 * The phone's share sheet, where there is one. With `file` (a PNG on this site) it shares the
 * picture itself, with the link as its text, and hides itself where pictures can't be shared.
 */
export function ShareButton({ url, file }: { url: string; file?: string }) {
  const [can, setCan] = useState(false);
  const [pic, setPic] = useState<File | null>(null);
  useEffect(() => setCan(typeof navigator !== 'undefined' && 'share' in navigator), []);
  // Fetched ahead of the tap: iOS only opens the share sheet straight from the tap itself.
  useEffect(() => {
    if (!can || !file) return;
    let live = true;
    setPic(null);
    fetch(file)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!live || !b) return;
        const f = new File([b], 'fatcap-invite.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [f] })) setPic(f);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [can, file]);
  if (!can || (file && !pic)) return null;
  return (
    <button type="button" className={`btn small${file ? ' solid' : ''}`} onClick={() => navigator.share(pic ? { files: [pic], text: url } : { url }).catch(() => {})}>
      {file ? 'Share sticker' : 'Share link'}
    </button>
  );
}

export function PrintButton() {
  return <button type="button" className="btn solid" onClick={() => window.print()}>Print sheet</button>;
}
