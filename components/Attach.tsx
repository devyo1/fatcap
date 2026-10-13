'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaToken, mediaUrl } from '@/lib/media-token';
import { insertLine, setFieldValue } from '@/lib/dom';
import { prepare } from '@/lib/upload';

const PER_POST = 6;

/**
 * Image / GIF button for a forum or DM composer. Uploads, then writes [img:<id>] on its own line
 * into the textarea `target` (by id). Pasting an image into the textarea works too. (Chat has its own.)
 */
export default function Attach({ target }: { target: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState('');
  const [ids, setIds] = useState<string[]>([]);

  const area = () => document.getElementById(target) as HTMLTextAreaElement | null;

  const insert = useCallback((id: string) => {
    const el = document.getElementById(target) as HTMLTextAreaElement | null;
    if (el) insertLine(el, mediaToken(id));
  }, [target]);

  const upload = useCallback(async (files: File[]) => {
    setErr('');
    const room = PER_POST - ids.length;
    if (room <= 0) { setErr(`Up to ${PER_POST} images at a time.`); return; }
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith('image/')) { setErr('Images and GIFs only.'); continue; }
      setBusy((n) => n + 1);
      try {
        const body = new FormData();
        body.append('file', await prepare(file), 'upload');
        const r = await fetch('/api/media', { method: 'POST', body });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.id) throw new Error(d.error || 'Upload failed.');
        insert(d.id);
        setIds((cur) => [...cur, d.id]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Upload failed.');
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }, [ids.length, insert]);

  // Paste an image straight into the textarea.
  useEffect(() => {
    const el = area();
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      upload(files);
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  });

  // Forget thumbnails once the form is sent (the textarea gets cleared or the page moves on).
  useEffect(() => {
    const el = area();
    const form = el?.form;
    if (!form) return;
    const reset = () => setIds([]);
    form.addEventListener('submit', reset);
    return () => form.removeEventListener('submit', reset);
  });

  function remove(id: string) {
    setIds((cur) => cur.filter((x) => x !== id));
    const el = area();
    if (el) {
      setFieldValue(el, el.value.replace(new RegExp(`\\n?\\[img:${id.replace(/[-]/g, '\\-')}\\][^\\n]*\\n?`), '\n').replace(/^\n+/, ''));
    }
    fetch(`/api/media/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <div className="att">
      <input
        ref={input} type="file" accept="image/*" multiple hidden
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) upload(f); }}
      />
      <button type="button" className="chip attach-btn" onClick={() => input.current?.click()} disabled={busy > 0} aria-label="Add an image or GIF">
        {busy ? 'Uploading…' : <><span>+ Image</span></>}
      </button>
      {ids.length > 0 && (
        <ul className="thumbs" aria-label="Attached images">
          {ids.map((id) => (
            <li key={id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(id)} alt="" />
              <button type="button" onClick={() => remove(id)} aria-label="Remove image">&times;</button>
            </li>
          ))}
        </ul>
      )}
      {err && <span className="attach-err mono" role="alert">{err}</span>}
    </div>
  );
}
