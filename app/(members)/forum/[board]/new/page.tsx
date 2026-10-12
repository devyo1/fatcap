import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CITY, LIMITS, boardBySlug } from '@/lib/config';
import { createThread } from '@/app/actions';
import Notice from '@/components/Notice';

export const metadata = { title: 'New thread' };

export default async function NewThread({ params, searchParams }: { params: Promise<{ board: string }>; searchParams: Promise<{ error?: string }> }) {
  const board = boardBySlug((await params).board);
  if (!board) notFound();
  const { error } = await searchParams;

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">{CITY}</Link><span>/</span><Link href={`/forum/${board.slug}`}>{board.name}</Link><span>/</span><span>New</span>
      </nav>
      <div className="head"><h1 className="wide h1">New thread</h1></div>
      <Notice error={error} />
      <form action={createThread} className="stack" style={{ marginTop: 24 }}>
        <input type="hidden" name="board" value={board.slug} />
        <div className="field">
          <label className="mono" htmlFor="title">Title</label>
          <input className="input" id="title" name="title" maxLength={LIMITS.title} required autoComplete="off" />
        </div>
        <div className="field">
          <label className="mono" htmlFor="body">Post</label>
          <textarea className="textarea" id="body" name="body" maxLength={LIMITS.body} required rows={9} />
        </div>
        <div className="actions">
          <button className="btn solid" type="submit">Post in {board.name}</button>
          <Link className="mono mute" href={`/forum/${board.slug}`}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
