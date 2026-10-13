// Browser helpers shared by client components.

/**
 * Set a textarea/input's value so React notices too (a plain `el.value = x` is invisible to
 * controlled inputs like the chat box), then fire the input event drafts and others listen for.
 */
export function setFieldValue(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Put a token (an [img:...] line) at the caret of a textarea, on a line of its own. */
export function insertLine(el: HTMLTextAreaElement, token: string) {
  const at = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, at), after = el.value.slice(at);
  const lead = before && !before.endsWith('\n') ? '\n' : '';
  const trail = after.startsWith('\n') ? '' : '\n';
  setFieldValue(el, before + lead + token + trail + after);
  const caret = (before + lead + token + trail).length;
  el.setSelectionRange(caret, caret);
}
