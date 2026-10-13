'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CURRENCIES } from '@/lib/money';
import { LIMITS } from '@/lib/config';
import { mediaUrl } from '@/lib/media-token';
import { uploadImage, pdfPages } from '@/lib/upload';
import RichText from './RichText';

export type BuilderPage =
  | { kind: 'image'; media: string; caption?: string; fit?: 'cover' | 'contain' }
  | { kind: 'text'; body: string };

export type ZineDefaults = {
  title?: string; about?: string; price?: string; currency?: string; preview?: number; shape?: 'tall' | 'square'; pages?: BuilderPage[];
};

const MAX_PAGES = 120;
const MAX_TEXT = 1400;
const MAX_CAPTION = 160;

type Page = BuilderPage & { key: string };
let seq = 0;
const keyed = (p: BuilderPage): Page => ({ ...p, key: `p${++seq}` });

/** A page drawn the way it reads in the zine viewer, scaled to whatever box holds it. */
export function PageFace({ p }: { p: BuilderPage }) {
  if (p.kind === 'text') {
    return <div className="zv-text">{p.body.trim() ? <RichText text={p.body} className="zv-body" /> : <p className="zv-empty mono">Empty page</p>}</div>;
  }
  return (
    <figure className={`zv-pic ${p.fit ?? 'cover'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(p.media)} alt="" draggable={false} />
      {p.caption && <figcaption className="mono">{p.caption}</figcaption>}
    </figure>
  );
}

type Draft = { title: string; about: string; price: string; currency: string; preview: number; shape: 'tall' | 'square'; pages: BuilderPage[] };

/**
 * Put a zine together page by page: pictures (filling the page, or whole on paper, with a caption)
 * and pages of text. Pick a page to change it, move it, or take it out. A new zine's work in
 * progress is kept on this device until it's sent.
 */
export default function ZineBuilder({ action, id, defaults = {}, cancelHref, submit, reviewed }: {
  action: (form: FormData) => void | Promise<void>; id?: number; defaults?: ZineDefaults; cancelHref: string; submit: string; reviewed: boolean;
}) {
  const draftKey = `zine-draft:${id ?? 'new'}`;
  const [title, setTitle] = useState(defaults.title ?? '');
  const [about, setAbout] = useState(defaults.about ?? '');
  const [price, setPrice] = useState(defaults.price ?? '');
  const [currency, setCurrency] = useState(defaults.currency ?? 'CAD');
  const [preview, setPreview] = useState(defaults.preview ?? 3);
  const [shape, setShape] = useState<'tall' | 'square'>(defaults.shape ?? 'tall');
  const [pages, setPages] = useState<Page[]>(() => (defaults.pages ?? []).map(keyed));
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(0);
  const [pdf, setPdf] = useState<string | null>(null); // progress while a PDF comes in
  const [err, setErr] = useState('');
  const [restored, setRestored] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const pdfFile = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const focusText = useRef(false);
  const ready = useRef(false);
  const cur = pages[sel];
  const paid = !!price.trim() && Number(price.replace(',', '.')) > 0;

  // A new zine picks up where this device left off.
  useEffect(() => {
    if (id) { ready.current = true; return; }
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as Draft | null;
      if (d?.pages?.length || d?.title) {
        setTitle(d.title ?? ''); setAbout(d.about ?? ''); setPrice(d.price ?? ''); setCurrency(d.currency ?? 'CAD');
        setPreview(d.preview ?? 3); setShape(d.shape === 'square' ? 'square' : 'tall'); setPages((d.pages ?? []).map(keyed));
        setRestored(true);
      }
    } catch {}
    ready.current = true;
  }, [id, draftKey]);

  useEffect(() => {
    if (id || !ready.current) return;
    const t = setTimeout(() => {
      try {
        const d: Draft = { title, about, price, currency, preview, shape, pages: pages.map(({ key: _key, ...p }) => p) };
        localStorage.setItem(draftKey, JSON.stringify(d));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [id, draftKey, title, about, price, currency, preview, shape, pages]);

  useEffect(() => {
    if (focusText.current && cur?.kind === 'text') { focusText.current = false; text.current?.focus(); }
  }, [cur]);

  const insertAt = (at: number, list: Page[]) => setPages((all) => { const next = [...all]; next.splice(at, 0, ...list); return next; });

  async function addPictures(files: File[]) {
    setErr('');
    const room = MAX_PAGES - pages.length;
    const list = files.filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (!list.length) { if (files.length) setErr(room ? 'Pictures only.' : `Up to ${MAX_PAGES} pages.`); return; }
    let at = pages.length ? sel + 1 : 0;
    for (const f of list) {
      setBusy((n) => n + 1);
      try {
        const media = await uploadImage(f);
        insertAt(at, [keyed({ kind: 'image', media, fit: 'cover' })]);
        setSel(at);
        at += 1;
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Upload failed.');
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  /** A PDF, page by page: each page comes in as a picture page, whole on paper. */
  async function importPdf(f: File) {
    setErr('');
    const room = MAX_PAGES - pages.length;
    if (room <= 0) { setErr(`Up to ${MAX_PAGES} pages.`); return; }
    let at = pages.length ? sel + 1 : 0;
    const fresh = !pages.length;
    // A page the same shape as the zine fills it (a PDF brings its own margins); any other sits whole on paper.
    let target = shape === 'square' ? 1 : 1 / 1.414;
    setPdf('Opening the PDF...');
    try {
      const done = await pdfPages(f, room, async (jpeg, n, total, ratio) => {
        if (fresh && n === 1) target = ratio > 0.86 ? 1 : 1 / 1.414;
        setPdf(`Page ${n} of ${total}...`);
        const media = await uploadImage(jpeg);
        insertAt(at, [keyed({ kind: 'image', media, fit: Math.abs(ratio - target) < 0.04 ? 'cover' : 'contain' })]);
        setSel(at);
        at += 1;
      });
      // A first import sets the page shape from the PDF's own pages.
      if (fresh && done.ratio) setShape(done.ratio > 0.86 ? 'square' : 'tall');
      if (done.pages > room) setErr(`Only the first ${room} pages fit (up to ${MAX_PAGES}).`);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Couldn't read that PDF.");
    } finally {
      setPdf(null);
    }
  }

  function addText() {
    if (pages.length >= MAX_PAGES) return;
    const at = pages.length ? sel + 1 : 0;
    insertAt(at, [keyed({ kind: 'text', body: '' })]);
    setSel(at);
    focusText.current = true;
  }

  const update = (fields: Partial<BuilderPage>) => setPages((all) => all.map((p, i) => (i === sel ? ({ ...p, ...fields } as Page) : p)));
  const move = (dir: -1 | 1) => {
    const to = sel + dir;
    if (to < 0 || to >= pages.length) return;
    setPages((all) => { const next = [...all]; [next[sel], next[to]] = [next[to], next[sel]]; return next; });
    setSel(to);
  };
  const remove = () => {
    setPages((all) => all.filter((_, i) => i !== sel));
    setSel((s) => Math.max(0, Math.min(s, pages.length - 2)));
  };

  const json = JSON.stringify(pages.map(({ key: _key, ...p }) => p));
  return (
    <form action={action} className="stack compose-form zine-form" onSubmit={() => { try { localStorage.removeItem(draftKey); } catch {} }}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="pages" value={json} />
      <input type="hidden" name="shape" value={shape} />
      {restored && <p className="notice mono">Picked up where you left off on this device.</p>}

      <div className="field">
        <label className="mono" htmlFor="z-title">Title</label>
        <input className="input big" id="z-title" name="title" maxLength={LIMITS.title} required autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label className="mono" htmlFor="z-about">About it</label>
        <textarea className="textarea" id="z-about" name="body" rows={3} maxLength={2000} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What it is, who's in it. Shows under the zine." />
      </div>

      <fieldset className="zb">
        <legend className="mono mute">Pages</legend>
        <div className="zb-bar">
          <span className="mono mute">{pages.length} {pages.length === 1 ? 'page' : 'pages'}{pdf ? ` / ${pdf}` : busy > 0 ? ` / adding ${busy}...` : ''}</span>
          <div className="seg-radio mono" role="radiogroup" aria-label="Page shape">
            <label><input type="radio" name="shape-pick" checked={shape === 'tall'} onChange={() => setShape('tall')} /><span>Tall</span></label>
            <label><input type="radio" name="shape-pick" checked={shape === 'square'} onChange={() => setShape('square')} /><span>Square</span></label>
          </div>
        </div>
        <ol className={`zb-pages ${shape}`} aria-label="Pages">
          {pages.map((p, i) => (
            <li key={p.key}>
              <button type="button" className={`zb-page${i === sel ? ' on' : ''}`} onClick={() => setSel(i)} aria-label={i === 0 ? 'Cover' : `Page ${i + 1}`} aria-current={i === sel ? 'true' : undefined}>
                <PageFace p={p} />
              </button>
              <span className="zb-n mono">{i === 0 ? 'Cover' : i + 1}</span>
            </li>
          ))}
          <li className="zb-adds">
            <button type="button" className="zb-new" onClick={() => file.current?.click()} disabled={busy > 0 || pages.length >= MAX_PAGES}>
              <b>+</b><span className="mono">Pictures</span>
            </button>
            <button type="button" className="zb-new" onClick={addText} disabled={!!pdf || pages.length >= MAX_PAGES}>
              <b>Aa</b><span className="mono">Text</span>
            </button>
            <button type="button" className="zb-new" onClick={() => pdfFile.current?.click()} disabled={!!pdf || busy > 0 || pages.length >= MAX_PAGES}>
              <b>PDF</b><span className="mono">Import</span>
            </button>
          </li>
        </ol>
        <input ref={pdfFile} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importPdf(f); }} />
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) void addPictures(f); }} />
        {err && <p className="attach-err mono" role="alert">{err}</p>}
        {!pages.length && <p className="hint mono">Start with the cover: a picture, or a page of text. Already have it as a PDF? Import it and every page comes in as a page. Up to {MAX_PAGES} pages.</p>}

        {cur && (
          <div className="zb-edit">
            <div className={`zb-big ${shape}`}><PageFace p={cur} /></div>
            <div className="zb-tools">
              <span className="mono mute">{sel === 0 ? 'Cover' : `Page ${sel + 1}`} / {cur.kind === 'text' ? 'text' : 'picture'}</span>
              {cur.kind === 'text' ? (
                <>
                  <textarea
                    ref={text} className="textarea" rows={9} value={cur.body} maxLength={MAX_TEXT}
                    onChange={(e) => update({ body: e.target.value })}
                    placeholder={'Write the page.\n## a heading, **bold**, *italic*, > a quote, - a list.'}
                  />
                  <span className="hint mono">{cur.body.length} / {MAX_TEXT}. Too long for one page? Carry on on the next.</span>
                </>
              ) : (
                <>
                  <input className="input" value={cur.caption ?? ''} maxLength={MAX_CAPTION} onChange={(e) => update({ caption: e.target.value })} placeholder="Caption (optional)" />
                  <div className="seg-radio mono" role="radiogroup" aria-label="How the picture sits">
                    <label><input type="radio" name="fit-pick" checked={(cur.fit ?? 'cover') === 'cover'} onChange={() => update({ fit: 'cover' })} /><span>Fill the page</span></label>
                    <label><input type="radio" name="fit-pick" checked={cur.fit === 'contain'} onChange={() => update({ fit: 'contain' })} /><span>Whole picture</span></label>
                  </div>
                </>
              )}
              <div className="actions zb-move">
                <button type="button" className="btn small" onClick={() => move(-1)} disabled={sel === 0} aria-label="Move page earlier">&larr;</button>
                <button type="button" className="btn small" onClick={() => move(1)} disabled={sel >= pages.length - 1} aria-label="Move page later">&rarr;</button>
                <button type="button" className="btn small danger" onClick={remove}>Remove page</button>
              </div>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="choice">
        <legend className="mono mute">Price</legend>
        <div className="field-row">
          <div className="field">
            <label className="mono" htmlFor="z-price">Price</label>
            <input className="input" id="z-price" name="price" inputMode="decimal" placeholder="Free" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field">
            <label className="mono" htmlFor="z-currency">Currency</label>
            <select className="input select" id="z-currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {paid && (
            <div className="field">
              <label className="mono" htmlFor="z-preview">Free to look at</label>
              <select className="input select" id="z-preview" name="preview" value={preview} onChange={(e) => setPreview(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>First {n} {n === 1 ? 'page' : 'pages'}</option>)}
              </select>
            </div>
          )}
        </div>
        <p className="hint mono">
          {paid
            ? 'Readers see the first pages, then get it from you: they pay you directly and mark it paid, and when you confirm, the whole zine opens up for them.'
            : 'Leave the price empty and it’s free: every member can read all of it.'}
        </p>
      </fieldset>

      {!reviewed && <p className="hint mono">Market posts go up once an admin has had a look. You&apos;ll get an alert.</p>}
      <div className="actions">
        <button className="btn solid" type="submit" disabled={busy > 0 || !!pdf || !pages.length}>{submit}</button>
        <Link className="mono mute" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
