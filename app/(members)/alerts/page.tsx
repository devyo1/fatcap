import Link from 'next/link';
import type { ReactNode } from 'react';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ago } from '@/lib/format';

export const metadata = { title: 'Alerts' };

type Alert = {
  id: number; kind: string; count: number; actor: string | null; thread_id: number | null; post_id: number | null; chat_id: number | null;
  deal_id: number | null; title: string | null; read_at: string | null; created_at: string;
};

// "<actor> <verb> <title>" for most alerts; market alerts that aren't about someone doing something read differently.
const VERB: Record<string, string> = {
  comment_reply: 'replied to your comment in',
  reply: 'commented on your thread',
  follow: 'commented in',
  mention: 'mentioned you in',
  chat_mention: 'mentioned you in',
  chat_reply: 'replied to you in',
  offer: 'made an offer on',
  offer_accepted: 'accepted your offer on',
  offer_declined: 'declined your offer on',
  bought: 'bought',
  bid: 'bid on',
  second_chance: 'offered you',
  deal_paid: 'sent payment for',
  deal_confirmed: 'confirmed your payment for',
  deal_sent: 'shipped',
  deal_complete: 'completed the deal for',
  deal_cancelled: 'cancelled the deal for',
};

function line(a: Alert): ReactNode {
  const title = <i>{a.chat_id ? 'chat' : a.title ?? 'a thread'}</i>;
  switch (a.kind) {
    case 'report': return <><b>A member</b> reported something in {title}</>;
    case 'outbid': return <>Outbid on {title}</>;
    case 'won': return <>You won {title}</>;
    case 'auction_ended': return <>Auction ended: {title}</>;
    default: return <><b>{a.actor ?? 'Someone'}</b> {VERB[a.kind] ?? 'posted in'} {title}</>;
  }
}

function href(a: Alert) {
  if (a.kind === 'report') return '/admin?tab=reports';
  if (a.deal_id) return `/market#d${a.deal_id}`;
  if (a.chat_id) return `/chat#c${a.chat_id}`;
  if (a.thread_id) return `/forum/t/${a.thread_id}${a.post_id ? `#p${a.post_id}` : ''}`;
  return '/forum';
}

export default async function Alerts() {
  const me = await requireUser();
  const alerts = await q<Alert>(
    `SELECT n.id, n.kind, n.count, a.username AS actor, n.thread_id, n.post_id, n.chat_id, n.deal_id,
            COALESCE(t.title, d.title) AS title, n.read_at, n.created_at
       FROM notifications n
       LEFT JOIN members a ON a.id = n.actor_id
       LEFT JOIN threads t ON t.id = n.thread_id
       LEFT JOIN deals d ON d.id = n.deal_id
      WHERE n.member_id = $1 AND (t.id IS NULL OR (NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now())))
      ORDER BY n.created_at DESC LIMIT 60`,
    [me.id],
  );
  // Opening this page counts as reading them; the unread ones still show highlighted this once.
  await q('UPDATE notifications SET read_at = now() WHERE member_id = $1 AND read_at IS NULL', [me.id]);

  return (
    <>
      <div className="page-head"><h1 className="title">Alerts</h1></div>
      {alerts.length ? (
        <ul className="rows">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link className={`row${a.read_at ? '' : ' unread'}`} href={href(a)}>
                <span className="t alert">
                  {!a.read_at && <span className="new" aria-label="New" />}
                  {line(a)}
                  {a.count > 1 && <span className="mono mute"> / {a.count} new</span>}
                </span>
                <span className="n mono">{ago(a.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty mono">No alerts.</p>
      )}
    </>
  );
}
