'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import RichText from './RichText';

type Msg = { id: number; username: string | null; body: string; created_at: string };

const POLL_MS = 2500;
const RESYNC_MS = 30000; // full reload now and then picks up messages an admin removed

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function left(ms: number) {
  if (ms <= 0) return 'now';
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

export default function ChatRoom({ me, isAdmin, initial, wipeAt: firstWipe, max }: { me: string; isAdmin: boolean; initial: Msg[]; wipeAt: string; max: number }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [wipeAt, setWipeAt] = useState(firstWipe);
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false); // clock-based text only renders in the browser
  useEffect(() => setMounted(true), []);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;

  const load = useCallback(async (full = false) => {
    try {
      const r = await fetch(`/api/chat?after=${full ? 0 : lastId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d: { messages: Msg[]; wipeAt: string } = await r.json();
      setWipeAt(d.wipeAt);
      setMsgs((cur) => {
        if (full) return d.messages;
        const seen = new Set(cur.map((m) => m.id));
        const add = d.messages.filter((m) => !seen.has(m.id));
        return add.length ? [...cur, ...add].slice(-300) : cur;
      });
    } catch {}
  }, [lastId]);

  // Poll for new messages while the tab is visible; full resync every so often.
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

  // Countdown; when the window rolls over, the chat empties.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (now >= new Date(wipeAt).getTime()) { setMsgs([]); load(true); }
  }, [now, wipeAt, load]);

  // Keep pinned to the bottom unless the reader scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setErr('');
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || 'Could not send.'); return; }
      setText(''); stick.current = true; await load();
    } catch { setErr('Could not send. Check your connection.'); }
    finally { setSending(false); }
  }

  async function remove(id: number) {
    await fetch(`/api/chat?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setMsgs((cur) => cur.filter((m) => m.id !== id));
  }

  return (
    <div className="chat">
      <div className="chat-bar mono">
        <span><span className="live-dot" aria-hidden="true" />Live / {msgs.length} {msgs.length === 1 ? 'message' : 'messages'}</span>
        <span className="mute">{mounted ? `Wipes in ${left(new Date(wipeAt).getTime() - now)}` : ''}</span>
      </div>

      <div className="chat-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Chat messages">
        {msgs.length ? msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const grouped = prev && prev.username === m.username && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
          return (
            <div key={m.id} className={`cmsg${grouped ? ' grouped' : ''}${m.username === me ? ' mine' : ''}`}>
              {grouped ? <span className="cmsg-gap" /> : <Avatar name={m.username} size={30} />}
              <div className="cmsg-main">
                {!grouped && (
                  <div className="cmsg-head mono">
                    {m.username ? <Link href={`/u/${encodeURIComponent(m.username)}`}>{m.username}</Link> : <span>gone</span>}
                    <span className="mute">{mounted ? time(m.created_at) : ''}</span>
                  </div>
                )}
                <RichText text={m.body} className="body cmsg-body" />
              </div>
              {isAdmin && <button type="button" className="cmsg-x mono" onClick={() => remove(m.id)} aria-label="Delete message">&times;</button>}
            </div>
          );
        }) : (
          <p className="empty mono chat-empty">Fresh slate. Say something.</p>
        )}
      </div>

      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr" htmlFor="chat-input">Message everyone</label>
        <textarea
          id="chat-input" className="textarea" rows={1} maxLength={max} value={text} placeholder="Message everyone"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="btn solid" type="submit" disabled={sending || !text.trim()}>Send</button>
      </form>
      {err && <p className="notice err mono" role="alert">{err}</p>}
    </div>
  );
}
