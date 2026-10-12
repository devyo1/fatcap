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
};

export default function ThreadRows({ rows, showBoard = false, empty }: { rows: ThreadRow[]; showBoard?: boolean; empty: string }) {
  if (!rows.length) return <p className="empty mono">{empty}</p>;
  return (
    <ul className="rows">
      {rows.map((t) => (
        <li key={t.id}>
          <Link className="row" href={`/forum/t/${t.id}`}>
            <span className="t">{t.title}</span>
            <span className="n mono">{t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}</span>
            <span className="m mono">
              {showBoard && <>{boardBySlug(t.board)?.name ?? t.board} / </>}
              {t.author ?? 'gone'} / {ago(t.last_post_at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
