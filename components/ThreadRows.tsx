import Link from 'next/link';
import { ago } from '@/lib/format';
import { boardBySlug } from '@/lib/config';

export type ThreadRow = {
  id: number;
  title: string;
  board: string;
  author: string | null;
  reply_count: number;
  last_post_at: string;
  pinned?: boolean;
  locked?: boolean;
  unread?: boolean;
};

export default function ThreadRows({ rows, showBoard = false, empty }: { rows: ThreadRow[]; showBoard?: boolean; empty: string }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="rows">
      {rows.map((t) => (
        <li key={t.id}>
          <Link className={`row${t.unread ? ' unread' : ''}`} href={`/forum/t/${t.id}`}>
            <span className="t">
              {t.unread && <span className="new" aria-label="New activity" />}
              {t.title}
            </span>
            <span className="n mono">{t.reply_count} {t.reply_count === 1 ? 'comment' : 'comments'}</span>
            <span className="m mono">
              {t.pinned && <span className="pill on">Pinned</span>}
              {t.locked && <span className="pill">Locked</span>}
              {showBoard && <span>{boardBySlug(t.board)?.name ?? t.board}</span>}
              <span>{t.author ?? 'gone'}</span>
              <span>{ago(t.last_post_at)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
