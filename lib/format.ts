export function ago(input: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(input).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return new Date(input).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function date(input: string | Date) {
  return new Date(input).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');

/** Time until a moment, short: "6d", "23h", "40m". */
export function left(input: string | Date) {
  const s = Math.max(0, (new Date(input).getTime() - Date.now()) / 1000);
  if (s >= 2 * 86400) return `${Math.round(s / 86400)}d`;
  if (s >= 3600) return `${Math.ceil(s / 3600)}h`;
  return `${Math.max(1, Math.ceil(s / 60))}m`;
}
