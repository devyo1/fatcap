import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BOARDS, LIMITS, boardBySlug } from '@/lib/config';
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
        <Link href="/forum">Forum</Link><span>/</span><Link href={`/forum/${board.slug}`}>{board.name}</Link><span>/</span><span>New</span>
      </nav>
      <div className="head"><h1 className="title">New thread</h1></div>
      <Notice error={error} />
      <form action={createThread} className="stack" style={{ marginTop: 24 }}>
        <div className="field">
          <label className="mono" htmlFor="board">Board</label>
          <select className="input select" id="board" name="board" defaultValue={board.slug}>
            {BOARDS.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="mono" htmlFor="title">Title</label>
          <input className="input" id="title" name="title" maxLength={LIMITS.title} required autoComplete="off" />
        </div>
        <div className="field">
          <label className="mono" htmlFor="body">Post</label>
          <textarea className="textarea" id="body" name="body" maxLength={LIMITS.body} required rows={9} />
          <span className="hint mono">@name to mention someone. Start a line with &gt; to quote. **bold**. Links work.</span>
        </div>
        <div className="actions">
          <button className="btn solid" type="submit">Post thread</button>
          <Link className="mono mute" href={`/forum/${board.slug}`}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
