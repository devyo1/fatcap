import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser, type User } from '@/lib/auth';
import { LIMITS, boardBySlug } from '@/lib/config';
import { ago } from '@/lib/format';
import { reply, deletePost, deleteThread, editPost, editThread, toggleProps, setThreadFlag } from '@/app/actions';
import RichText from '@/components/RichText';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';

type Thread = {
  id: number; board: string; title: string; body: string; user_id: number | null; author: string | null;
  created_at: string; edited_at: string | null; reply_count: number; pinned: boolean; locked: boolean;
  props: number; mine: boolean;
};
type Post = {
  id: number; parent_id: number | null; body: string; user_id: number | null; author: string | null;
  created_at: string; edited_at: string | null; deleted: boolean; props: number; mine: boolean;
};

// Comments nest this deep; replies below that stack flat under the last level.
const MAX_DEPTH = 4;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = await one<{ title: string }>('SELECT title FROM threads WHERE id = $1 AND NOT deleted', [Number((await params).id) || 0]);
  return { title: t?.title ?? 'Thread' };
}

function Author({ name }: { name: string | null }) {
  return name ? <Link className="who" href={`/u/${encodeURIComponent(name)}`}>{name}</Link> : <span className="who">gone</span>;
}

function LikeButton({ target, id, count, mine, back }: { target: 'thread' | 'post'; id: number; count: number; mine: boolean; back: string }) {
  return (
    <form action={toggleProps}>
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <button className={`chip${mine ? ' on' : ''}`} type="submit" aria-pressed={mine} title={mine ? 'Unlike' : 'Like'}>
        {mine ? 'Liked' : 'Like'}{count ? <span className="n">{count}</span> : null}
      </button>
    </form>
  );
}

function Comment({ post, kids, depth, me, threadId, locked }: { post: Post; kids: Map<number, Post[]>; depth: number; me: User; threadId: number; locked: boolean }) {
  const children = kids.get(post.id) ?? [];
  const canEdit = !post.deleted && post.user_id === me.id;
  const canDelete = !post.deleted && (post.user_id === me.id || me.is_admin);
  const anchor = `/forum/t/${threadId}#p${post.id}`;
  const nested = (
    children.length > 0 && (
      <div className={depth < MAX_DEPTH ? 'kids' : 'kids flat'}>
        {children.map((c) => <Comment key={c.id} post={c} kids={kids} depth={depth + 1} me={me} threadId={threadId} locked={locked} />)}
      </div>
    )
  );

  if (post.deleted) {
    return (
      <div className="comment" id={`p${post.id}`}>
        <p className="gone mono">Comment deleted</p>
        {nested}
      </div>
    );
  }

  return (
    <div className="comment" id={`p${post.id}`}>
      <header className="mono">
        <Avatar name={post.author} size={22} />
        <Author name={post.author} />
        <a className="when" href={`#p${post.id}`}>{ago(post.created_at)}</a>
        {post.edited_at && <span className="mute">edited</span>}
      </header>
      <RichText text={post.body} />
      <div className="acts">
        <LikeButton target="post" id={post.id} count={post.props} mine={post.mine} back={anchor} />
        {!locked && (
          <details className="pop">
            <summary className="chip">Reply</summary>
            <form action={reply} className="stack inline-form">
              <input type="hidden" name="thread" value={threadId} />
              <input type="hidden" name="parent" value={post.id} />
              <label className="sr" htmlFor={`r${post.id}`}>Reply to {post.author ?? 'comment'}</label>
              <textarea className="textarea" id={`r${post.id}`} name="body" rows={3} maxLength={LIMITS.body} required placeholder={`Reply to ${post.author ?? 'this'}`} />
              <div className="actions"><button className="btn solid small" type="submit">Reply</button></div>
            </form>
          </details>
        )}
        {canEdit && (
          <details className="pop">
            <summary className="chip">Edit</summary>
            <form action={editPost} className="stack inline-form">
              <input type="hidden" name="id" value={post.id} />
              <label className="sr" htmlFor={`e${post.id}`}>Edit comment</label>
              <textarea className="textarea" id={`e${post.id}`} name="body" rows={4} maxLength={LIMITS.body} required defaultValue={post.body} />
              <div className="actions"><button className="btn solid small" type="submit">Save</button></div>
            </form>
          </details>
        )}
        {canDelete && (
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <button className="chip danger" type="submit">Delete</button>
          </form>
        )}
      </div>
      {nested}
    </div>
  );
}

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  const { error } = await searchParams;
  if (!Number.isInteger(id)) notFound();

  const thread = await one<Thread>(
    `SELECT t.*, u.username AS author,
            (SELECT count(*)::int FROM props WHERE target = 'thread' AND target_id = t.id) AS props,
            EXISTS (SELECT 1 FROM props WHERE target = 'thread' AND target_id = t.id AND member_id = $2) AS mine
       FROM threads t LEFT JOIN members u ON u.id = t.user_id
      WHERE t.id = $1 AND NOT t.deleted`,
    [id, me.id],
  );
  if (!thread) notFound();
  const posts = await q<Post>(
    `SELECT p.id, p.parent_id, p.body, p.user_id, u.username AS author, p.created_at, p.edited_at, p.deleted,
            (SELECT count(*)::int FROM props WHERE target = 'post' AND target_id = p.id) AS props,
            EXISTS (SELECT 1 FROM props WHERE target = 'post' AND target_id = p.id AND member_id = $2) AS mine
       FROM posts p LEFT JOIN members u ON u.id = p.user_id
      WHERE p.thread_id = $1 ORDER BY p.created_at LIMIT 1000`,
    [id, me.id],
  );
  await q(
    `INSERT INTO thread_reads (member_id, thread_id, read_at) VALUES ($1, $2, now())
     ON CONFLICT (member_id, thread_id) DO UPDATE SET read_at = now()`,
    [me.id, id],
  );

  // Build the comment tree. Deleted comments only show if something hangs off them.
  const ids = new Set(posts.map((p) => p.id));
  const kids = new Map<number, Post[]>();
  const top: Post[] = [];
  for (const p of posts) {
    if (p.parent_id && ids.has(p.parent_id)) kids.set(p.parent_id, [...(kids.get(p.parent_id) ?? []), p]);
    else top.push(p);
  }
  const hasLive = (p: Post): boolean => !p.deleted || (kids.get(p.id) ?? []).some(hasLive);
  for (const [k, list] of kids) kids.set(k, list.filter(hasLive));
  const roots = top.filter(hasLive);

  const board = boardBySlug(thread.board);
  const canEdit = thread.user_id === me.id;
  const canDelete = thread.user_id === me.id || me.is_admin;
  const locked = thread.locked && !me.is_admin;

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">Forum</Link><span>/</span>
        <Link href={`/forum/${thread.board}`}>{board?.name ?? thread.board}</Link>
      </nav>
      <div className="head">
        <div>
          <div className="flags mono">
            {thread.pinned && <span className="pill on">Pinned</span>}
            {thread.locked && <span className="pill">Locked</span>}
          </div>
          <h1 className="title thread-title">{thread.title}</h1>
        </div>
        {me.is_admin && (
          <div className="actions">
            <form action={setThreadFlag}><input type="hidden" name="id" value={thread.id} /><input type="hidden" name="flag" value="pinned" /><button className="btn small" type="submit">{thread.pinned ? 'Unpin' : 'Pin'}</button></form>
            <form action={setThreadFlag}><input type="hidden" name="id" value={thread.id} /><input type="hidden" name="flag" value="locked" /><button className="btn small" type="submit">{thread.locked ? 'Unlock' : 'Lock'}</button></form>
          </div>
        )}
      </div>

      <article className="op">
        <header className="mono">
          <Avatar name={thread.author} size={30} />
          <Author name={thread.author} /><span>{ago(thread.created_at)}</span>
          {thread.edited_at && <span className="mute">edited</span>}
        </header>
        <RichText text={thread.body} />
        <div className="acts">
          <LikeButton target="thread" id={thread.id} count={thread.props} mine={thread.mine} back={`/forum/t/${thread.id}`} />
          {canEdit && (
            <details className="pop">
              <summary className="chip">Edit</summary>
              <form action={editThread} className="stack inline-form">
                <input type="hidden" name="id" value={thread.id} />
                <div className="field"><label className="mono" htmlFor="et">Title</label><input className="input" id="et" name="title" maxLength={LIMITS.title} required defaultValue={thread.title} /></div>
                <div className="field"><label className="mono" htmlFor="eb">Post</label><textarea className="textarea" id="eb" name="body" rows={6} maxLength={LIMITS.body} required defaultValue={thread.body} /></div>
                <div className="actions"><button className="btn solid small" type="submit">Save</button></div>
              </form>
            </details>
          )}
          {canDelete && (
            <form action={deleteThread}>
              <input type="hidden" name="id" value={thread.id} />
              <button className="chip danger" type="submit">Delete thread</button>
            </form>
          )}
        </div>
      </article>

      <section className="comments" aria-label="Comments">
        <div className="comments-head mono">
          <span className="br">{thread.reply_count} {thread.reply_count === 1 ? 'comment' : 'comments'}</span>
        </div>
        <Notice error={error} />
        {locked ? (
          <p className="notice mono">This thread is locked.</p>
        ) : (
          <form action={reply} className="stack composer" id="reply">
            <input type="hidden" name="thread" value={thread.id} />
            <label className="sr" htmlFor="body">Comment</label>
            <textarea className="textarea" id="body" name="body" maxLength={LIMITS.body} required rows={3} placeholder="Add a comment. @name to mention someone, > to quote." />
            <div className="actions"><button className="btn solid" type="submit">Comment</button></div>
          </form>
        )}
        {roots.length ? (
          roots.map((p) => <Comment key={p.id} post={p} kids={kids} depth={1} me={me} threadId={thread.id} locked={locked} />)
        ) : (
          <p className="empty mono">No comments yet.</p>
        )}
      </section>
    </>
  );
}
