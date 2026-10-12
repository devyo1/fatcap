import Link from 'next/link';
import type { ReactNode } from 'react';

// Light formatting for posts and messages, built from React elements (never raw HTML):
//   blank line = new paragraph, "> " = quote, URLs become links, @name links a member, **bold**,
//   and a line that is only an image link shows the image.
const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(^|[^A-Za-z0-9_])@([A-Za-z0-9_][A-Za-z0-9_.-]{1,19}[A-Za-z0-9_])|\*\*([^*\n]+)\*\*/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (m[1]) {
      out.push(text.slice(last, at));
      out.push(<a key={`${key}-${i++}`} href={m[1]} target="_blank" rel="noopener noreferrer nofollow">{m[1].replace(/^https?:\/\//, '')}</a>);
    } else if (m[3]) {
      out.push(text.slice(last, at) + m[2]);
      out.push(<Link key={`${key}-${i++}`} className="mention" href={`/u/${encodeURIComponent(m[3])}`}>@{m[3]}</Link>);
    } else {
      out.push(text.slice(last, at));
      out.push(<strong key={`${key}-${i++}`}>{m[4]}</strong>);
    }
    last = at + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

function lines(block: string[], key: string) {
  return block.flatMap((l, j) => (j ? [<br key={`${key}-br${j}`} />, ...inline(l, `${key}-${j}`)] : inline(l, `${key}-${j}`)));
}

const IMAGE = /^https?:\/\/\S+\.(?:jpe?g|png|gif|webp|avif)(?:\?\S*)?$/i;

export default function RichText({ text, className = 'body' }: { text: string; className?: string }) {
  const blocks: { quote: boolean; lines: string[]; img?: string }[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    if (IMAGE.test(raw.trim())) {
      blocks.push({ quote: false, lines: [raw.trim()], img: raw.trim() }, { quote: false, lines: [] });
      continue;
    }
    const quote = /^\s*>/.test(raw);
    const line = quote ? raw.replace(/^\s*>\s?/, '') : raw;
    const cur = blocks[blocks.length - 1];
    if (!quote && !line.trim()) { blocks.push({ quote: false, lines: [] }); continue; }
    if (cur && cur.quote === quote && (cur.lines.length || quote)) cur.lines.push(line);
    else blocks.push({ quote, lines: [line] });
  }
  return (
    <div className={className}>
      {blocks.filter((b) => b.lines.length).map((b, k) =>
        b.img ? (
          <a key={k} className="pic" href={b.img} target="_blank" rel="noopener noreferrer nofollow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.img} alt="" loading="lazy" referrerPolicy="no-referrer" />
          </a>
        ) : b.quote ? <blockquote key={k}>{lines(b.lines, `q${k}`)}</blockquote> : <p key={k}>{lines(b.lines, `p${k}`)}</p>,
      )}
    </div>
  );
}

/** Lower-cased usernames mentioned in a text. */
export function mentionsIn(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(TOKEN)) if (m[3]) names.add(m[3].toLowerCase());
  return [...names].slice(0, 10);
}
