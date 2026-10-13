'use client';

import { useEffect } from 'react';

const KEY = 'fc-draft:';
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};
type Field = HTMLTextAreaElement | HTMLInputElement;
const keyOf = (el: Element) => `${KEY}${location.pathname}#${el.id}`;

/**
 * Keeps what you type in any field marked data-draft, on this device only. If posting fails
 * (the page comes back with ?error), the page re-renders (like / follow / save), or you wander
 * off mid-sentence, it's still there. Once a post goes through, the draft is dropped; logging
 * out drops them all.
 */
export default function Drafts() {
  useEffect(() => {
    const seen = new WeakSet<Element>();

    // A draft field just appeared (page load, navigation, or a re-render after an action).
    const restore = (el: Field) => {
      if (seen.has(el)) return;
      seen.add(el);
      const k = keyOf(el);
      const failed = new URLSearchParams(location.search).has('error');
      if (store.get(`${k}:sent`)) {
        store.del(`${k}:sent`);
        if (!failed) { store.del(k); return; } // it went through
      }
      const saved = store.get(k);
      if (saved && !el.value) {
        el.value = saved;
        el.dispatchEvent(new Event('input', { bubbles: true })); // lets the box size itself
        el.closest('details')?.setAttribute('open', '');
      }
    };
    const scan = (root: ParentNode) => root.querySelectorAll<Field>('[data-draft]').forEach(restore);

    scan(document);
    const watch = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (n.matches('[data-draft]')) restore(n as Field);
          scan(n);
        }
      }
    });
    watch.observe(document.body, { childList: true, subtree: true });

    const onInput = (e: Event) => {
      const el = e.target as Field;
      if (!el.matches?.('[data-draft]')) return;
      if (el.value.trim()) store.set(keyOf(el), el.value); else store.del(keyOf(el));
    };
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement;
      if (form.hasAttribute('data-logout')) { // shared phone: leave nothing behind
        try { Object.keys(localStorage).filter((k) => k.startsWith(KEY)).forEach((k) => localStorage.removeItem(k)); } catch {}
        return;
      }
      for (const el of form.querySelectorAll('[data-draft]')) store.set(`${keyOf(el)}:sent`, '1');
    };
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      watch.disconnect();
      document.removeEventListener('input', onInput);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);

  return null;
}
