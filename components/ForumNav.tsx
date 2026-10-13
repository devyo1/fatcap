import Link from 'next/link';
import { BOARDS, type Board, type Sub } from '@/lib/config';
import { ago } from '@/lib/format';
import type { TopicStat } from '@/lib/threads';
import Avatar from './Avatar';

type Stats = Map<string, TopicStat>;
const subsOf = (b: Board) => b.subs as readonly Sub[];

/** Segmented links: Feed / Recent / Top, or Recent / New / Top. */
export function SortTabs({ items, current, label }: { items: { id: string; name: React.ReactNode; href: string }[]; current: string; label: string }) {
  return (
    <nav className="seg-tabs mono" aria-label={label}>
      {items.map((i) => (
        <Link key={i.id} href={i.href} aria-current={i.id === current ? 'page' : undefined} scroll={false}>{i.name}</Link>
      ))}
    </nav>
  );
}

/** The whole forum as a compact tree, for the sidebar. */
export function ForumTree({ stats }: { stats: Stats }) {
  return (
    <ul className="ftree">
      {BOARDS.map((b) => (
        <li key={b.slug}>
          <Link className="ftree-board" href={`/forum/${b.slug}`}>{b.name}</Link>
          <ul>
            {subsOf(b).map((s) => {
              const st = stats.get(`${b.slug}/${s.slug}`);
              return (
                <li key={s.slug}>
                  <Link href={`/forum/${b.slug}/${s.slug}`}>
                    <span>{s.name}{st?.unread ? <span className="new" aria-label="New activity" /> : null}</span>
                    <span className="n mono">{st?.threads ?? 0}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Quick jump to the boards (phones, where the sidebar tree sits below the feed). */
export function BoardChips() {
  return (
    <nav className="board-chips mono" aria-label="Boards">
      {BOARDS.map((b) => <Link key={b.slug} href={`/forum/${b.slug}`}>{b.name}</Link>)}
    </nav>
  );
}

/** A board's sub-forums as classic forum rows: name, counts, latest thread. */
export function SubForums({ board, stats }: { board: Board; stats: Stats }) {
  return (
    <ul className="cats">
      {subsOf(board).map((s) => {
        const st = stats.get(`${board.slug}/${s.slug}`);
        return (
          <li key={s.slug}>
            <Link href={`/forum/${board.slug}/${s.slug}`} className="cat">
              <span className="cat-main">
                <span className="cat-name">{s.name}{st?.unread ? <span className="new" aria-label="New activity" /> : null}</span>
                <span className="mute">{s.blurb}</span>
              </span>
              <span className="cat-nums mono mute">
                <span><b>{st?.threads ?? 0}</b> threads</span>
                <span><b>{st?.comments ?? 0}</b> comments</span>
              </span>
              <span className="cat-last">
                {st?.latest_title ? (
                  <>
                    <Avatar name={st.latest_author} size={24} />
                    <span>
                      <span className="cat-last-t">{st.latest_title}</span>
                      <span className="mono mute">{st.latest_author ?? 'gone'} / {st.last ? ago(st.last) : ''}</span>
                    </span>
                  </>
                ) : <span className="mono mute">Empty</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
