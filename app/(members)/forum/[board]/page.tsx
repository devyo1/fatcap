import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { boardBySlug } from '@/lib/config';
import { listThreads } from '@/lib/threads';
import ThreadRows from '@/components/ThreadRows';

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }) {
  return { title: boardBySlug((await params).board)?.name ?? 'Forum' };
}

export default async function Board({ params, searchParams }: { params: Promise<{ board: string }>; searchParams: Promise<{ page?: string }> }) {
  const me = await requireUser();
  const board = boardBySlug((await params).board);
  if (!board) notFound();
  const { rows, more, page } = await listThreads(me, { board: board.slug, page: Number((await searchParams).page) || 1 });
  const base = `/forum/${board.slug}`;

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">Forum</Link><span>/</span><span>{board.name}</span>
      </nav>
      <div className="head">
        <div>
          <h1 className="title">{board.name}</h1>
          <p className="sub mute">{board.blurb}</p>
        </div>
        <Link className="btn solid" href={`${base}/new`}>New thread</Link>
      </div>
      <ThreadRows rows={rows} empty={page > 1 ? 'Nothing further back.' : 'No threads here yet.'} />
      {(page > 1 || more) && (
        <nav className="pager mono" aria-label="Pages">
          {page > 1 ? <Link href={page === 2 ? base : `${base}?page=${page - 1}`}>&larr; Newer</Link> : <span />}
          <span className="mute">Page {page}</span>
          {more ? <Link href={`${base}?page=${page + 1}`}>Older &rarr;</Link> : <span />}
        </nav>
      )}
    </>
  );
}
