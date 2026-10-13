'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import RichText from './RichText';

type Msg = {
  id: number; username: string | null; body: string; created_at: string;
  image_id: number | null; reply_to: number | null; reply_user: string | null; reply_body: string | null; reply_image: boolean;
};
type Reactions = Record<number, { emoji: string; users: string[] }[]>;

const POLL_MS = 2500;
const RESYNC_MS = 30000; // full reload now and then picks up messages an admin removed
const GROUP_MS = 5 * 60_000;

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function countdown(ms: number) {
  if (ms <= 0) return '0s';
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return `${h ? `${h}h ` : ''}${h || m ? `${m}m ` : ''}${s}s`;
}

/** Photos get shrunk in the browser before upload; GIFs go up untouched so they keep moving. */
async function prepareImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.82));
    return blob ? new File([blob], 'photo.webp', { type: 'image/webp' }) : file;
  } catch { return file; }
}

const ImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
);

export default function ChatRoom({ me, isAdmin, initial, reactions: firstReactions, wipeAt: firstWipe, max, emojis }: {
  me: string; isAdmin: boolean; initial: Msg[]; reactions: Reactions; wipeAt: string; max: number; emojis: string[];
}) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [reactions, setReactions] = useState<Reactions>(firstReactions);
  const [wipeAt, setWipeAt] = useState(firstWipe);
  const [now, setNow] = useState(0);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [active, setActive] = useState<number | null>(null); // message whose tools are open (tap on phones)
  const [picker, setPicker] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;

  const load = useCallback(async (full = false) => {
    try {
      const r = await fetch(`/api/chat?after=${full ? 0 : lastId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d: { messages: Msg[]; reactions: Reactions; wipeAt: string } = await r.json();
      setWipeAt(d.wipeAt);
      setReactions(d.reactions);
      setMsgs((cur) => {
        if (full) return d.messages;
        const seen = new Set(cur.map((m) => m.id));
        const add = d.messages.filter((m) => !seen.has(m.id));
        return add.length ? [...cur, ...add].slice(-300) : cur;
      });
    } catch {}
  }, [lastId]);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, RESYNC_MS);
    const onShow = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow); };
  }, [load]);

  // Countdown (browser clock only); when it hits zero the chat empties.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (now && now >= new Date(wipeAt).getTime()) { setMsgs([]); setReactions({}); load(true); }
  }, [now, wipeAt, load]);

  // Opening a link to a message (from Alerts) scrolls to it.
  useEffect(() => {
    const id = location.hash.match(/^#c(\d+)$/)?.[1];
    const el = id && document.getElementById(`c${id}`);
    if (el) { stick.current = false; el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  async function pick(f: File | null | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Pictures only.'); return; }
    const ready = await prepareImage(f);
    if (ready.size > 3 * 1024 * 1024) { setErr('That picture is too big (3 MB max).'); return; }
    setErr(''); setFile(ready);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(ready); });
    inputRef.current?.focus();
  }
  function clearFile() {
    setFile(null);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return ''; });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function send() {
    const body = text.trim();
    if ((!body && !file) || sending) return;
    setSending(true); setErr('');
    const form = new FormData();
    form.set('body', body);
    if (file) form.set('image', file);
    if (replyTo) form.set('reply_to', String(replyTo.id));
    try {
      const r = await fetch('/api/chat', { method: 'POST', body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || 'Could not send.'); return; }
      setText(''); setReplyTo(null); clearFile(); stick.current = true; await load();
    } catch { setErr('Could not send. Check your connection.'); }
    finally { setSending(false); }
  }

  async function react(id: number, emoji: string) {
    setPicker(null);
    // Show it straight away, then let the server confirm.
    setReactions((cur) => {
      const list = (cur[id] ?? []).map((r) => ({ ...r, users: [...r.users] }));
      const hit = list.find((r) => r.emoji === emoji);
      if (hit?.users.includes(me)) hit.users = hit.users.filter((u) => u !== me);
      else if (hit) hit.users.push(me);
      else list.push({ emoji, users: [me] });
      return { ...cur, [id]: list.filter((r) => r.users.length) };
    });
    await fetch('/api/chat/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, emoji }) }).catch(() => {});
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/chat?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setMsgs((cur) => cur.filter((m) => m.id !== id));
  }

  function startReply(m: Msg) {
    setReplyTo(m); setActive(null); setPicker(null);
    inputRef.current?.focus();
  }

  const left = now ? new Date(wipeAt).getTime() - now : 0;

  return (
    <div className="chat" onClick={(e) => { if (!(e.target as HTMLElement).closest('.cmsg')) { setActive(null); setPicker(null); } }}>
      <div className="chat-bar mono">
        <span><span className="live-dot" aria-hidden="true" />Live</span>
        <span className="wipes" aria-live="off">{now ? <>Wipes in: <b>{countdown(left)}</b></> : null}</span>
      </div>

      <div className="chat-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Chat messages">
        {msgs.length ? msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const grouped = !m.reply_to && prev && prev.username === m.username && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_MS;
          const mine = m.username === me;
          const rx = reactions[m.id] ?? [];
          const open = active === m.id;
          return (
            <div key={m.id} id={`c${m.id}`} className={`cmsg${grouped ? ' grouped' : ''}${mine ? ' mine' : ''}${open ? ' open' : ''}`}
              onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button, img')) setActive(open ? null : m.id); }}>
              {grouped ? <span className="cmsg-gap" /> : <Avatar name={m.username} size={30} />}
              <div className="cmsg-main">
                {!grouped && (
                  <div className="cmsg-head mono">
                    {m.username ? <Link href={`/u/${encodeURIComponent(m.username)}`}>{m.username}</Link> : <span>gone</span>}
                    <span className="mute">{now ? time(m.created_at) : ''}</span>
                  </div>
                )}
                {m.reply_to && (
                  <a className="cquote" href={`#c${m.reply_to}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(`c${m.reply_to}`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }}>
                    <b>{m.reply_user ?? 'gone'}</b> {m.reply_body || (m.reply_image ? 'sent a picture' : 'message removed')}
                  </a>
                )}
                {m.body && <RichText text={m.body} className="body cmsg-body" />}
                {m.image_id && (
                  <a className="cimg" href={`/api/chat/img/${m.image_id}`} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/chat/img/${m.image_id}`} alt={`Picture from ${m.username ?? 'someone'}`} loading="lazy" />
                  </a>
                )}
                {rx.length > 0 && (
                  <div className="creacts">
                    {rx.map((r) => (
                      <button key={r.emoji} type="button" className={`creact${r.users.includes(me) ? ' on' : ''}`} onClick={() => react(m.id, r.emoji)} title={r.users.join(', ')}>
                        <span aria-hidden="true">{r.emoji}</span><span className="mono">{r.users.length}</span>
                        <span className="sr">{r.users.includes(me) ? 'Remove your reaction' : 'React'} {r.emoji}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="ctools" role="group" aria-label="Message actions">
                <button type="button" className="ctool mono" onClick={() => setPicker(picker === m.id ? null : m.id)} aria-expanded={picker === m.id}>React</button>
                <button type="button" className="ctool mono" onClick={() => startReply(m)}>Reply</button>
                {isAdmin && <button type="button" className="ctool mono danger" onClick={() => remove(m.id)}>Delete</button>}
                {picker === m.id && (
                  <div className="cpicker" role="menu">
                    {emojis.map((e) => <button key={e} type="button" role="menuitem" onClick={() => react(m.id, e)} aria-label={`React ${e}`}>{e}</button>)}
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <p className="empty mono chat-empty">Fresh slate. Say something.</p>
        )}
      </div>

      {(replyTo || preview) && (
        <div className="cpending">
          {replyTo && (
            <div className="cpend-row mono">
              <span>Replying to <b>{replyTo.username ?? 'gone'}</b>: <span className="mute">{(replyTo.body || 'picture').slice(0, 80)}</span></span>
              <button type="button" className="ctool" onClick={() => setReplyTo(null)} aria-label="Cancel reply">&times;</button>
            </div>
          )}
          {preview && (
            <div className="cpend-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Picture to send" className="cthumb" />
              <button type="button" className="ctool" onClick={clearFile} aria-label="Remove picture">&times;</button>
            </div>
          )}
        </div>
      )}
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" className="attach" onClick={() => fileRef.current?.click()} aria-label="Add a picture or GIF"><ImageIcon /></button>
        <label className="sr" htmlFor="chat-input">Message everyone</label>
        <textarea
          id="chat-input" ref={inputRef} className="textarea" rows={1} maxLength={max} value={text} placeholder="Message everyone"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); pick(f); } }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            if (e.key === 'Escape') { setReplyTo(null); }
          }}
        />
        <button className="btn solid" type="submit" disabled={sending || (!text.trim() && !file)}>{sending ? '...' : 'Send'}</button>
      </form>
      {err && <p className="notice err mono chat-err" role="alert">{err}</p>}
    </div>
  );
}
