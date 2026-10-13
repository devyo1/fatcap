import Link from 'next/link';
import { ago } from '@/lib/format';
import { boardBySlug } from '@/lib/config';
import Avatar from './Avatar';

export type ThreadRow = {
  id: number;
  title: string;
  board: string;
  author: string | null;
  reply_count: number;
  last_post_at: string;
  created_at?: string;
  pinned?: boolean;
  locked?: boolean;
  unread?: boolean;
  props?: number;
  last_author?: string | null;
};

export default function ThreadRows({ rows, showBoard = false, empty, numbered = false }: { rows: ThreadRow[]; showBoard?: boolean; empty: string; numbered?: boolean }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className={`rows threads${numbered ? ' numbered' : ''}`}>
      {rows.map((t, i) => (
        <li key={t.id}>
          <Link className={`row trow${t.unread ? ' unread' : ''}`} href={`/forum/t/${t.id}`}>
            {numbered ? <span className="rank mono">{String(i + 1).padStart(2, '0')}</span> : <Avatar name={t.author} size={36} />}
            <span className="tb">
              <span className="t">
                {t.unread && <span className="new" aria-label="New activity" />}
                {t.title}
              </span>
              <span className="m mono">
                {t.pinned && <span className="pill on">Pinned</span>}
                {t.locked && <span className="pill">Locked</span>}
                {showBoard && <span className="board-tag">{boardBySlug(t.board)?.name ?? t.board}</span>}
                <span>{t.author ?? 'gone'}</span>
                {t.last_author && t.reply_count > 0
                  ? <span>last: {t.last_author} {ago(t.last_post_at)}</span>
                  : <span>{ago(t.last_post_at)}</span>}
              </span>
            </span>
            <span className="stats-col mono">
              <span><b>{t.reply_count}</b> {t.reply_count === 1 ? 'comment' : 'comments'}</span>
              {t.props ? <span className="mute"><b>{t.props}</b> {t.props === 1 ? 'like' : 'likes'}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
