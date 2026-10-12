import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser, usernameKey } from '@/lib/auth';
import { LIMITS } from '@/lib/config';
import { ago } from '@/lib/format';
import { sendMessage } from '@/app/actions';
import RichText from '@/components/RichText';
import Notice from '@/components/Notice';
import { RefreshEvery, ScrollToEnd } from '@/components/Live';

type Msg = { id: number; sender_id: number | null; body: string; created_at: string };

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return { title: `Messages / ${decodeURIComponent((await params).name)}` };
}

export default async function Conversation({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ error?: string }> }) {
  const me = await requireUser();
  const name = decodeURIComponent((await params).name);
  const { error } = await searchParams;
  const other = await one<{ id: number; username: string }>('SELECT id, username FROM members WHERE username_key = $1 AND NOT banned', [usernameKey(name)]);
  if (!other) notFound();
  if (other.id === me.id) redirect('/messages');

  const [a, b] = me.id < other.id ? [me.id, other.id] : [other.id, me.id];
  const conv = await one<{ id: number }>('SELECT id FROM conversations WHERE member_a = $1 AND member_b = $2', [a, b]);
  const msgs = conv
    ? await q<Msg>(
        `SELECT * FROM (SELECT id, sender_id, body, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 200) m ORDER BY created_at`,
        [conv.id],
      )
    : [];
  if (conv) {
    await q(
      `UPDATE conversations SET a_read_at = CASE WHEN member_a = $2 THEN now() ELSE a_read_at END,
                                b_read_at = CASE WHEN member_b = $2 THEN now() ELSE b_read_at END
        WHERE id = $1`,
      [conv.id, me.id],
    );
  }

  return (
    <>
      <RefreshEvery seconds={8} />
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/messages">Messages</Link><span>/</span><span>{other.username}</span>
      </nav>
      <div className="head">
        <h1 className="wide h2"><Link href={`/u/${encodeURIComponent(other.username)}`}>{other.username}</Link></h1>
        <span className="mono mute">Private</span>
      </div>

      <div className="dm">
        {msgs.length ? msgs.map((m) => (
          <div key={m.id} className={`bubble${m.sender_id === me.id ? ' me' : ''}`}>
            <RichText text={m.body} className="body" />
            <span className="mono mute stamp">{m.sender_id === me.id ? 'You' : other.username} / {ago(m.created_at)}</span>
          </div>
        )) : <p className="empty mono">Say something.</p>}
        <ScrollToEnd count={msgs.length} />
      </div>

      <Notice error={error} />
      <form action={sendMessage} className="dm-compose">
        <input type="hidden" name="to" value={other.username} />
        <label className="sr" htmlFor="msg">Message {other.username}</label>
        <textarea className="textarea" id="msg" name="body" rows={2} maxLength={LIMITS.message} required placeholder={`Message ${other.username}`} />
        <button className="btn solid" type="submit">Send</button>
      </form>
    </>
  );
}
