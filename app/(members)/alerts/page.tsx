import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ago } from '@/lib/format';

export const metadata = { title: 'Alerts' };

type Alert = { id: number; kind: string; actor: string | null; thread_id: number | null; post_id: number | null; chat_id: number | null; title: string | null; read_at: string | null; created_at: string };

const VERB: Record<string, string> = {
  comment_reply: 'replied to your comment in',
  reply: 'commented on your thread',
  mention: 'mentioned you in',
  chat_mention: 'mentioned you in',
  chat_reply: 'replied to you in',
};

export default async function Alerts() {
  const me = await requireUser();
  const alerts = await q<Alert>(
    `SELECT n.id, n.kind, a.username AS actor, n.thread_id, n.post_id, n.chat_id, t.title, n.read_at, n.created_at
       FROM notifications n
       LEFT JOIN members a ON a.id = n.actor_id
       LEFT JOIN threads t ON t.id = n.thread_id
      WHERE n.member_id = $1 AND (t.id IS NULL OR NOT t.deleted)
      ORDER BY n.created_at DESC LIMIT 60`,
    [me.id],
  );
  // Opening this page counts as reading them; the unread ones still show highlighted this once.
  await q('UPDATE notifications SET read_at = now() WHERE member_id = $1 AND read_at IS NULL', [me.id]);

  return (
    <>
      <div className="head"><h1 className="title">Alerts</h1></div>
      {alerts.length ? (
        <ul className="rows">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link className={`row${a.read_at ? '' : ' unread'}`} href={a.chat_id ? `/chat#c${a.chat_id}` : a.thread_id ? `/forum/t/${a.thread_id}${a.post_id ? `#p${a.post_id}` : ''}` : '/forum'}>
                <span className="t alert">
                  {!a.read_at && <span className="new" aria-label="New" />}
                  <b>{a.actor ?? 'Someone'}</b> {VERB[a.kind] ?? 'posted in'} <i>{a.chat_id ? 'chat' : a.title ?? 'a thread'}</i>
                </span>
                <span className="n mono">{ago(a.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty mono">Nothing yet. Replies to your threads and comments, and @mentions, land here.</p>
      )}
    </>
  );
}
