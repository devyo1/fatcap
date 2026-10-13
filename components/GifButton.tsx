'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { insertLine } from '@/lib/dom';
import { mediaToken } from '@/lib/media-token';

type Gif = { id: string; title: string; w: number; h: number; preview: string };

// Whether GIF search is set up on the server; asked once per page load.
let ready: Promise<boolean> | null = null;
const gifsReady = () => (ready ??= fetch('/api/gif?probe=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { on: false })).then((d) => !!d.on).catch(() => false));

/**
 * GIF button + search. Picking one stores our own copy and drops [img:<id>] into the textarea
 * `target`; or, with `onFile`, hands back the file (the chat attaches it to its own upload).
 * Hidden when the server has no GIPHY key.
 */
export default function GifButton({ target, onFile, className = 'chip' }: { target?: string; onFile?: (file: File) => void; className?: string }) {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => { gifsReady().then(setOn); }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!on) return null;
  return (
    <span className="gif-wrap" ref={wrap}>
      <button
        type="button" className={className} aria-expanded={open} aria-haspopup="dialog"
        onClick={(e) => { setUp(e.currentTarget.getBoundingClientRect().top > window.innerHeight * 0.55); setOpen((o) => !o); }}
      >GIF</button>
      {open && <Picker up={up} target={target} onFile={onFile} onDone={() => setOpen(false)} />}
    </span>
  );
}

function Picker({ up, target, onFile, onDone }: { up: boolean; target?: string; onFile?: (file: File) => void; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Gif[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (query: string, offset: number) => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/gif?q=${encodeURIComponent(query)}&offset=${offset}`);
      const d = await r.json();
      if (mine !== seq.current) return;
      if (!r.ok) { setErr(d.error || 'Search failed.'); return; }
      setItems((cur) => (offset ? [...cur, ...d.results] : d.results));
      setNext(d.next);
    } catch {
      if (mine === seq.current) setErr('Search failed.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q.trim(), 0), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  async function pick(id: string) {
    if (picking) return;
    setPicking(true); setErr('');
    try {
      const r = await fetch('/api/gif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, raw: !!onFile }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Could not add that GIF.'); }
      if (onFile) {
        onFile(new File([await r.blob()], 'gif.webp', { type: 'image/webp' }));
      } else {
        const d = await r.json();
        const el = target ? (document.getElementById(target) as HTMLTextAreaElement | null) : null;
        if (el) { insertLine(el, mediaToken(d.id)); el.focus(); }
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add that GIF.');
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className={`gif-pop${up ? ' up' : ''}`} role="dialog" aria-label="Search GIFs">
      <div className="gif-top">
        <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" aria-label="Search GIFs" />
        <button type="button" className="gif-x" onClick={onDone} aria-label="Close">&times;</button>
      </div>
      <div
        className="gif-grid"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (next != null && !loading && el.scrollTop + el.clientHeight > el.scrollHeight - 200) load(q.trim(), next);
        }}
      >
        {items.map((g) => (
          <button key={g.id} type="button" className="gif-item" onClick={() => pick(g.id)} disabled={picking} style={{ aspectRatio: `${g.w} / ${g.h}` }} title={g.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.preview} alt={g.title} loading="lazy" />
          </button>
        ))}
        {!items.length && !loading && !err && <p className="mono mute gif-empty">No GIFs found.</p>}
      </div>
      <div className="gif-foot mono">
        <span>{picking ? 'Adding...' : loading ? 'Loading...' : err}</span>
        <span className="mute">Powered by GIPHY</span>
      </div>
    </div>
  );
}
