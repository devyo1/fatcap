import { boardBySlug, subBySlug } from '@/lib/config';
import { preview, type ThreadRow } from './ThreadRows';

const SIZES = ['xl', 'l', 'm', 's'] as const;

/**
 * A post without pictures, as a square poster: where it's from, the title set big, a few words
 * of the post, who wrote it. Four looks, picked by the thread, so a run of text posts still reads
 * like a wall of flyers. Sizes itself to its frame (`small` for grid tiles: title only).
 */
export function Poster({ t, small = false }: { t: ThreadRow; small?: boolean }) {
  const where = subBySlug(t.board, t.topic)?.name ?? boardBySlug(t.board)?.name ?? t.board;
  // Big as the title allows: by its length, and never so big its longest word won't fit on a line.
  const n = t.title.length;
  const longest = Math.max(0, ...t.title.split(/\s+/).map((w) => w.length));
  // (A small tile fits fewer letters to a line, so it steps down sooner.)
  const byLength = small ? (n <= 16 ? 0 : n <= 30 ? 1 : n <= 50 ? 2 : 3) : (n <= 22 ? 0 : n <= 44 ? 1 : n <= 80 ? 2 : 3);
  const byWord = small ? (longest > 9 ? 3 : longest > 7 ? 2 : longest > 6 ? 1 : 0) : (longest > 12 ? 3 : longest > 10 ? 2 : longest > 7 ? 1 : 0);
  const size = SIZES[Math.max(byLength, byWord)];
  const words = small ? '' : preview(t.text ?? t.excerpt ?? '');
  return (
    <span className={`poster v${t.id % 4} ${size}${small ? ' small' : ''}`}>
      <span className="poster-top mono"><span>{where}</span><i aria-hidden="true" /></span>
      <span className="poster-title">{t.title}</span>
      {words && <span className="poster-words">{words}</span>}
      {!small && <span className="poster-foot mono">{t.author ?? 'gone'}</span>}
    </span>
  );
}

/** The opening line of a post, for a pull quote: a sentence or so, never more than ~170 characters. */
export function pullQuote(text: string | null | undefined) {
  const s = preview(text ?? '');
  if (!s) return '';
  const m = s.match(/^(.{30,170}?[.!?])(?=\s|$)/);
  if (m) return m[1];
  if (s.length <= 170) return s;
  const cut = s.slice(0, 170);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120)).trimEnd()}…`;
}

/**
 * A post without pictures, for Cards: its opening line as a pull quote, set large on one of the
 * same four papers as the posters. (No text at all: the title as a poster instead.)
 */
export function Quote({ t }: { t: ThreadRow }) {
  const q = pullQuote(t.text ?? t.excerpt);
  if (!q) return <Poster t={t} />;
  const size = q.length <= 60 ? 'xl' : q.length <= 110 ? 'l' : 'm';
  return (
    <span className={`quote v${t.id % 4} ${size}`}>
      <span className="quote-mark" aria-hidden="true">&ldquo;</span>
      <span className="quote-text">{q}</span>
      <span className="quote-by mono">{t.author ?? 'gone'}</span>
    </span>
  );
}
