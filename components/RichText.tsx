import Link from 'next/link';
import type { ReactNode } from 'react';
import { MEDIA_LINE, mediaUrl } from '@/lib/media-token';

// Light formatting for posts and messages, built from React elements (never raw HTML).
//   Blocks: blank line = new paragraph, "> " quote, "## " heading, "---" section break,
//           "- " / "1. " lists, and a line reading [img:<id>] shows an uploaded image
//           (side by side when several follow each other; text after it on the line is a caption).
//   Inline: links, @name, #tags, **bold**, *italic*.
// Images hosted elsewhere stay plain links on purpose: embedding them would hand every reader's IP
// address to whoever runs that server.
const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(^|[^A-Za-z0-9_])@([A-Za-z0-9_][A-Za-z0-9_.-]{1,19}[A-Za-z0-9_])|\*\*([^*\n]+)\*\*|(^|[\s("'])\*([^*\s][^*\n]*?)\*(?=$|[\s).,!?;:"'])|(^|[^A-Za-z0-9_&#/])#([A-Za-z][A-Za-z0-9_]{1,29})(?![A-Za-z0-9_])/g;

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
    } else if (m[4]) {
      out.push(text.slice(last, at));
      out.push(<strong key={`${key}-${i++}`}>{m[4]}</strong>);
    } else if (m[6] !== undefined) {
      out.push(text.slice(last, at) + m[5]);
      out.push(<em key={`${key}-${i++}`}>{m[6]}</em>);
    } else {
      out.push(text.slice(last, at) + m[7]);
      out.push(<Link key={`${key}-${i++}`} className="tag" href={`/search?q=${encodeURIComponent(`#${m[8]}`)}`}>#{m[8]}</Link>);
    }
    last = at + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

function lines(block: string[], key: string) {
  return block.flatMap((l, j) => (j ? [<br key={`${key}-br${j}`} />, ...inline(l, `${key}-${j}`)] : inline(l, `${key}-${j}`)));
}

type Pic = { id: string; caption: string };
type Block =
  | { t: 'p' | 'quote'; lines: string[] }
  | { t: 'h'; text: string }
  | { t: 'hr' }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'pics'; pics: Pic[] };

const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const HEAD = /^\s*#{1,3}\s+(.+)$/;
const UL = /^\s*[-*]\s+(.+)$/;
const OL = /^\s*\d{1,2}[.)]\s+(.+)$/; // 1-2 digits, so a line starting "2009." stays a sentence
const QUOTE = /^\s*>\s?(.*)$/;

export function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const cur = () => blocks[blocks.length - 1];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const pic = MEDIA_LINE.exec(line.trim());
    const c = cur();
    if (pic) {
      const p = { id: pic[1], caption: (pic[2] ?? '').trim() };
      if (c?.t === 'pics') c.pics.push(p); else blocks.push({ t: 'pics', pics: [p] });
      continue;
    }
    if (!line.trim()) { if (c && c.t !== 'pics') blocks.push({ t: 'p', lines: [] }); continue; }
    if (HR.test(line)) { blocks.push({ t: 'hr' }); continue; }
    const h = HEAD.exec(line);
    if (h) { blocks.push({ t: 'h', text: h[1] }); continue; }
    const q = QUOTE.exec(line);
    if (q) { if (c?.t === 'quote') c.lines.push(q[1]); else blocks.push({ t: 'quote', lines: [q[1]] }); continue; }
    const ul = UL.exec(line), ol = ul ? null : OL.exec(line);
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol';
      const item = (ul ?? ol)![1];
      if (c?.t === t) c.items.push(item); else blocks.push({ t, items: [item] });
      continue;
    }
    if (c?.t === 'p' && c.lines.length) c.lines.push(line);
    else blocks.push({ t: 'p', lines: [line] });
  }
  return blocks.filter((b) => !(b.t === 'p' && !b.lines.length));
}

export default function RichText({ text, className = 'body' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {parse(text).map((b, k) => {
        switch (b.t) {
          case 'pics':
            return (
              <div key={k} className={`pics n${Math.min(b.pics.length, 3)}`}>
                {b.pics.map((p, i) => (
                  <figure key={i} className="fig">
                    <a className="pic" href={mediaUrl(p.id)} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(p.id)} alt={p.caption} loading="lazy" decoding="async" />
                    </a>
                    {p.caption && <figcaption>{inline(p.caption, `c${k}-${i}`)}</figcaption>}
                  </figure>
                ))}
              </div>
            );
          case 'h': return <h3 key={k}>{inline(b.text, `h${k}`)}</h3>;
          case 'hr': return <hr key={k} />;
          case 'ul': return <ul key={k}>{b.items.map((it, i) => <li key={i}>{inline(it, `u${k}-${i}`)}</li>)}</ul>;
          case 'ol': return <ol key={k}>{b.items.map((it, i) => <li key={i}>{inline(it, `o${k}-${i}`)}</li>)}</ol>;
          case 'quote': return <blockquote key={k}>{lines(b.lines, `q${k}`)}</blockquote>;
          default: return <p key={k}>{lines(b.lines, `p${k}`)}</p>;
        }
      })}
    </div>
  );
}

/** Lower-cased usernames mentioned in a text. */
export function mentionsIn(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(TOKEN)) if (m[3]) names.add(m[3].toLowerCase());
  return [...names].slice(0, 10);
}

/** About how long a post takes to read, in minutes (images left out). */
export function readingMinutes(text: string) {
  const words = text.replace(/\[img:[A-Za-z0-9_-]{16}\]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}
