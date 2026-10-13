import Link from 'next/link';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { requireUser, usernameKey } from '@/lib/auth';
import { ago } from '@/lib/format';
import { RefreshEvery } from '@/components/Live';

export const metadata = { title: 'Messages' };

type Conv = { id: number; other: string; last_message_at: string; snippet: string | null; from_me: boolean; unread: boolean };

async function startWith(form: FormData) {
  'use server';
  await requireUser();
  const name = String(form.get('to') ?? '').trim();
  if (!name) redirect('/messages');
  redirect(`/messages/${encodeURIComponent(usernameKey(name))}`);
}

export default async function Messages() {
  const me = await requireUser();
  const convs = await q<Conv>(
    `SELECT c.id, o.username AS other, c.last_message_at,
            (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS snippet,
            c.last_sender_id = $1 AS from_me,
            (c.last_sender_id IS DISTINCT FROM $1 AND c.last_sender_id IS NOT NULL AND
             COALESCE(CASE WHEN c.member_a = $1 THEN c.a_read_at ELSE c.b_read_at END < c.last_message_at, true)) AS unread
       FROM conversations c
       JOIN members o ON o.id = CASE WHEN c.member_a = $1 THEN c.member_b ELSE c.member_a END
      WHERE (c.member_a = $1 OR c.member_b = $1) AND c.last_sender_id IS NOT NULL
      ORDER BY c.last_message_at DESC LIMIT 100`,
    [me.id],
  );

  return (
    <>
      <RefreshEvery seconds={20} />
      <div className="head">
        <h1 className="title">Messages</h1>
        <form action={startWith} className="newdm">
          <label className="sr" htmlFor="to">Message a member</label>
          <input className="input" id="to" name="to" placeholder="Username" autoComplete="off" autoCapitalize="none" spellCheck={false} required />
          <button className="btn small" type="submit">Message</button>
        </form>
      </div>
      {convs.length ? (
        <ul className="rows">
          {convs.map((c) => (
            <li key={c.id}>
              <Link className={`row${c.unread ? ' unread' : ''}`} href={`/messages/${encodeURIComponent(c.other)}`}>
                <span className="t">{c.unread && <span className="new" aria-label="Unread" />}{c.other}</span>
                <span className="n mono">{ago(c.last_message_at)}</span>
                <span className="m snippet">{c.from_me ? 'You: ' : ''}{(c.snippet ?? '').slice(0, 140)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty mono">No messages yet. Open someone's profile and hit Message.</p>
      )}
    </>
  );
}
