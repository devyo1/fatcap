'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { moreThreads, type MoreQuery } from '@/app/browse-actions';
import ThreadRows, { type ThreadRow } from './ThreadRows';
import ListingGrid from './ListingGrid';
import ThreadCards from './ThreadCards';

const AUTO = 150; // loads by itself until this many rows are showing; past that it waits for a tap
const KEEP = 15 * 60 * 1000; // how long rows loaded here are kept for coming back

type Loaded = { start: number; fetched: number; rows: ThreadRow[]; done: boolean; at: number };
const noop = () => () => {};
function recall(key: string, start: number): Loaded | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Loaded | null;
    return v && v.start === start && Date.now() - v.at < KEEP ? v : null;
  } catch { return null; }
}

/**
 * The rest of a list, loaded in place as you reach the end (or with the button). Rows loaded here
 * are remembered for this tab, so going into a thread and coming back finds the list as long as
 * it was, at the same spot.
 */
export default function MoreRows({ query, start, have, size, grid = false, showBoard = false, showTopic = false }: {
  query: MoreQuery; start: number; have: number[]; size: number; grid?: boolean; showBoard?: boolean; showTopic?: boolean;
}) {
  const cards = !!query.cards;
  const key = `more:${JSON.stringify(query)}`;
  // False while hydrating (so the first render matches the server's), true from then on.
  const client = useSyncExternalStore(noop, () => true, () => false);
  const kept = useMemo(() => (client ? recall(key, start) : null), [client, key, start]);
  const [mine, setMine] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cur = mine ?? kept;
  const end = useRef<HTMLButtonElement>(null);
  const running = useRef(false);

  const known = useMemo(() => new Set(have), [have]);
  const rows = useMemo(() => (cur?.rows ?? []).filter((r) => !known.has(r.id)), [cur, known]);
  const done = !!cur?.done;
  const showing = start + (cur?.fetched ?? 0);

  const load = async () => {
    if (running.current || done) return;
    running.current = true; setBusy(true); setFailed(false);
    const base = cur ?? { start, fetched: 0, rows: [], done: false, at: 0 };
    try {
      const res = await moreThreads(query, start + base.fetched, size);
      const seen = new Set([...base.rows.map((r) => r.id), ...have]);
      const next: Loaded = {
        start, fetched: base.fetched + res.rows.length, done: !res.more, at: Date.now(),
        rows: [...base.rows, ...res.rows.filter((r) => !seen.has(r.id))],
      };
      setMine(next);
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
    } catch { setFailed(true); }
    running.current = false; setBusy(false);
  };
  const loadRef = useRef(load);
  loadRef.current = load;

  // Reaching the end of the list loads the next stretch, until it's long enough to want a tap.
  useEffect(() => {
    const el = end.current;
    if (!el || busy || failed || done || showing >= AUTO) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) loadRef.current(); }, { rootMargin: '0px 0px 700px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [busy, failed, done, showing]);

  return (
    <>
      {rows.length > 0 && (grid
        ? <ListingGrid rows={rows} empty="" showTopic={showTopic} />
        : cards
          ? <ThreadCards rows={rows} empty="" place={showBoard || showTopic} />
          : <ThreadRows rows={rows} empty="" showBoard={showBoard} showTopic={showTopic} />)}
      {!done && (
        <button ref={end} type="button" className="more-btn mono" onClick={load} disabled={busy} aria-busy={busy}>
          {busy ? <span className="more-dots" aria-label="Loading"><i /><i /><i /></span> : failed ? 'Couldn’t load. Try again' : 'Show more'}
        </button>
      )}
      {done && rows.length > 0 && <p className="list-end mono mute">That&rsquo;s everything.</p>}
    </>
  );
}
