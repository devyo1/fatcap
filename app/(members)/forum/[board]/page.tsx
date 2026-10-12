import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q } from '@/lib/db';
import { CITY, boardBySlug } from '@/lib/config';
import ThreadRows, { type ThreadRow } from '@/components/ThreadRows';

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }) {
  return { title: boardBySlug((await params).board)?.name ?? 'Forum' };
}

export default async function Board({ params }: { params: Promise<{ board: string }> }) {
  const board = boardBySlug((await params).board);
  if (!board) notFound();
  const rows = await q<ThreadRow>(
    `SELECT t.id, t.title, t.board, u.username AS author, t.reply_count, t.last_post_at
       FROM threads t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.city = $1 AND t.board = $2 AND NOT t.deleted
      ORDER BY t.last_post_at DESC LIMIT 100`,
    [CITY, board.slug],
  );

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">{CITY}</Link><span>/</span><span>{board.name}</span>
      </nav>
      <div className="head">
        <div>
          <h1 className="wide h1">{board.name}</h1>
          <p className="sub mute">{board.blurb}</p>
        </div>
        <Link className="btn solid" href={`/forum/${board.slug}/new`}>New thread</Link>
      </div>
      <ThreadRows rows={rows} empty="No threads here yet." />
    </>
  );
}
