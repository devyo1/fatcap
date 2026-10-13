'use client';

import { setFieldValue } from '@/lib/dom';
import { Quote } from './Icons';

/**
 * Quote into the comment box: whatever you've selected inside the post, or the start of it.
 * `target` is the id of the post's wrapper (its .body is a direct child).
 */
export default function QuoteButton({ target, author, composer = 'body' }: { target: string; author: string | null; composer?: string }) {
  function quote() {
    const body = document.getElementById(target)?.querySelector(':scope > .body') as HTMLElement | null;
    const box = document.getElementById(composer) as HTMLTextAreaElement | null;
    if (!body || !box) return;
    const sel = window.getSelection();
    let text = sel && !sel.isCollapsed && body.contains(sel.anchorNode) && body.contains(sel.focusNode) ? sel.toString() : body.innerText;
    text = text.trim().replace(/\n{3,}/g, '\n\n');
    if (text.length > 600) text = `${text.slice(0, 600).trimEnd()}...`;
    const block = `${author ? `> @${author}\n` : ''}${text.split('\n').map((l) => `> ${l}`).join('\n')}\n\n`;
    const value = box.value.trim() ? `${box.value.replace(/\s*$/, '')}\n\n${block}` : block;
    setFieldValue(box, value);
    box.focus({ preventScroll: true });
    box.setSelectionRange(value.length, value.length);
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  return (
    <button type="button" className="act" onClick={quote} title="Quote (select text first to quote part of it)">
      <Quote /><span>Quote</span>
    </button>
  );
}
