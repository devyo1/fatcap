// A short tap of haptic feedback, where the browser allows one.
//  - Android and other browsers with navigator.vibrate: a real vibration.
//  - iPhone (iOS 18+): Safari has no vibrate, but flipping a native switch control gives the
//    system "tick". It only fires during a touch, so it works for pull-to-refresh, not for
//    something arriving while the phone sits still.
let sw: HTMLLabelElement | null = null;

export function haptic(pattern: number | number[] = 10) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function' && navigator.vibrate(pattern)) return;
  } catch {}
  try {
    if (!sw) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      sw = document.createElement('label');
      sw.setAttribute('aria-hidden', 'true');
      sw.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      sw.appendChild(input);
      document.body.appendChild(sw);
    }
    sw.click();
  } catch {}
}
