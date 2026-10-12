import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CITY, LIMITS, boardBySlug } from '@/lib/config';
import { ago } from '@/lib/format';
import { reply, deletePost, deleteThread } from '@/app/actions';
import Notice from '@/components/Notice';

type Thread = { id: number; board: string; title: string; body: string; user_id: number | null; author: string | null; created_at: string; reply_count: number };
type Post = { id: number; body: string; user_id: number | null; author: string | null; created_at: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = await one<{ title: string }>('SELECT title FROM threads WHERE id = $1 AND NOT deleted', [Number((await params).id) || 0]);
  return { title: t?.title ?? 'Thread' };
}

function Author({ name }: { name: string | null }) {
  return name ? <Link href={`/u/${encodeURIComponent(name)}`}>{name}</Link> : <span>gone</span>;
}

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  const { error } = await searchParams;
  if (!Number.isInteger(id)) notFound();

  const thread = await one<Thread>(
    `SELECT t.*, u.username AS author FROM threads t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1 AND NOT t.deleted`,
    [id],
  );
  if (!thread) notFound();
  const posts = await q<Post>(
    `SELECT p.id, p.body, p.user_id, u.username AS author, p.created_at
       FROM posts p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.thread_id = $1 AND NOT p.deleted ORDER BY p.created_at`,
    [id],
  );
  const board = boardBySlug(thread.board);
  const canDelete = (uid: number | null) => me.is_admin || uid === me.id;

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">{CITY}</Link><span>/</span>
        <Link href={`/forum/${thread.board}`}>{board?.name ?? thread.board}</Link>
      </nav>
      <div className="head"><h1 className="wide h2" style={{ fontSize: 'clamp(26px, 4.4vw, 46px)' }}>{thread.title}</h1></div>

      <article className="post op">
        <header className="mono">
          <Author name={thread.author} /><span>{ago(thread.created_at)}</span>
          <span>{thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}</span>
        </header>
        <div className="body">{thread.body}</div>
        {canDelete(thread.user_id) && (
          <form action={deleteThread} className="tools">
            <input type="hidden" name="id" value={thread.id} />
            <button className="linkbtn mono mute" type="submit">Delete thread</button>
          </form>
        )}
      </article>

      {posts.map((p) => (
        <article className="post" id={`p${p.id}`} key={p.id}>
          <header className="mono"><Author name={p.author} /><span>{ago(p.created_at)}</span></header>
          <div className="body">{p.body}</div>
          {canDelete(p.user_id) && (
            <form action={deletePost} className="tools">
              <input type="hidden" name="id" value={p.id} />
              <button className="linkbtn mono mute" type="submit">Delete</button>
            </form>
          )}
        </article>
      ))}

      <section className="section" id="reply">
        <Notice error={error} />
        <form action={reply} className="stack">
          <input type="hidden" name="thread" value={thread.id} />
          <div className="field">
            <label className="mono" htmlFor="body">Reply</label>
            <textarea className="textarea" id="body" name="body" maxLength={LIMITS.body} required rows={5} />
          </div>
          <div className="actions"><button className="btn solid" type="submit">Reply</button></div>
        </form>
      </section>
    </>
  );
}
