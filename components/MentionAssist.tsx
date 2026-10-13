'use client';

import { useEffect, useRef, useState } from 'react';
import { setFieldValue } from '@/lib/dom';
import Avatar from './Avatar';

const TOKEN = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_.-]{1,20})$/;
type Box = { el: HTMLTextAreaElement; start: number; end: number; names: string[]; i: number; x: number; y: number };

/** Where the caret sits inside a textarea, in page coordinates (mirror-div measurement). */
function caretPoint(el: HTMLTextAreaElement, pos: number) {
  const cs = getComputedStyle(el);
  const div = document.createElement('div');
  for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'wordSpacing', 'tabSize'] as const) {
    div.style[p] = cs[p];
  }
  div.style.position = 'absolute'; div.style.visibility = 'hidden'; div.style.whiteSpace = 'pre-wrap'; div.style.overflowWrap = 'break-word';
  div.textContent = el.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = '​';
  div.appendChild(mark);
  document.body.appendChild(div);
  const r = el.getBoundingClientRect();
  const x = r.left + window.scrollX + mark.offsetLeft - el.scrollLeft;
  const y = r.top + window.scrollY + mark.offsetTop - el.scrollTop + (parseFloat(cs.lineHeight) || 20);
  div.remove();
  return { x: Math.min(x, window.scrollX + document.documentElement.clientWidth - 220), y };
}

/**
 * Typing @ followed by a letter or two in any text box suggests members. Arrow keys + Enter /
 * Tab to pick, Esc to dismiss, or tap a name.
 */
export default function MentionAssist() {
  const [box, setBox] = useState<Box | null>(null);
  const ref = useRef<Box | null>(null);
  ref.current = box;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0;
    const close = () => { seq++; setBox(null); };

    const onInput = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLTextAreaElement)) return;
      const caret = el.selectionStart ?? 0;
      const m = caret === el.selectionEnd ? TOKEN.exec(el.value.slice(0, caret)) : null;
      if (!m) { close(); return; }
      const prefix = m[2];
      const mine = ++seq;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const r = await fetch(`/api/members?q=${encodeURIComponent(prefix)}`, { cache: 'no-store' });
          const d: { names?: string[] } = await r.json();
          if (mine !== seq) return;
          if (!d.names?.length) { setBox(null); return; }
          const { x, y } = caretPoint(el, caret);
          setBox({ el, start: caret - prefix.length - 1, end: caret, names: d.names, i: 0, x, y });
        } catch { /* offline: no suggestions */ }
      }, 110);
    };

    // Capture phase on window, so Enter picks a name instead of sending the chat message.
    const onKey = (e: KeyboardEvent) => {
      const b = ref.current;
      if (!b || e.target !== b.el) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        setBox({ ...b, i: (b.i + (e.key === 'ArrowDown' ? 1 : -1) + b.names.length) % b.names.length });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault(); e.stopPropagation();
        pick(b, b.names[b.i]);
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        close();
      }
    };
    const onBlur = (e: FocusEvent) => { if (ref.current && e.target === ref.current.el) setTimeout(close, 150); };

    document.addEventListener('input', onInput);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusout', onBlur);
    window.addEventListener('resize', close);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('input', onInput);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusout', onBlur);
      window.removeEventListener('resize', close);
    };
  }, []);

  function pick(b: Box, name: string) {
    const v = b.el.value;
    const insert = `@${name} `;
    setFieldValue(b.el, v.slice(0, b.start) + insert + v.slice(b.end));
    const caret = b.start + insert.length;
    b.el.focus();
    b.el.setSelectionRange(caret, caret);
    setBox(null);
  }

  if (!box) return null;
  return (
    <ul className="mention-box" role="listbox" aria-label="Members" style={{ left: box.x, top: box.y }}>
      {box.names.map((n, i) => (
        <li key={n} role="option" aria-selected={i === box.i}>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(box, n); }}>
            <Avatar name={n} size={20} /><span>{n}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
