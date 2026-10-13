import Link from 'next/link';
import type { ReactNode } from 'react';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ago } from '@/lib/format';
import { SortTabs } from '@/components/ForumNav';

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

const REPLIES = ['comment_reply', 'reply', 'follow', 'mention', 'chat_mention', 'chat_reply'];
const MARKET = ['offer', 'offer_accepted', 'offer_declined', 'bought', 'bid', 'outbid', 'won', 'auction_ended', 'second_chance',
  'deal_paid', 'deal_confirmed', 'deal_sent', 'deal_complete', 'deal_cancelled'];

/** "Today", "Yesterday", "This week", "Earlier", in Montreal time (the club's clock, same as the chat wipe). */
const dayOf = (x: Date) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(x));
function bucket(iso: string) {
  const diff = Math.round((dayOf(new Date()) - dayOf(new Date(iso))) / 864e5);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? 'This week' : 'Earlier';
}

export default async function Alerts({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const me = await requireUser();
  const show = (await searchParams).show === 'replies' ? 'replies' : (await searchParams).show === 'market' ? 'market' : 'all';
  const alerts = await q<Alert>(
    `SELECT n.id, n.kind, n.count, a.username AS actor, n.thread_id, n.post_id, n.chat_id, n.deal_id,
            COALESCE(t.title, d.title) AS title, n.read_at, n.created_at
       FROM notifications n
       LEFT JOIN members a ON a.id = n.actor_id
       LEFT JOIN threads t ON t.id = n.thread_id
       LEFT JOIN deals d ON d.id = n.deal_id
      WHERE n.member_id = $1 AND (t.id IS NULL OR (NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now())))
        AND ($2::text[] IS NULL OR n.kind = ANY($2::text[]))
      ORDER BY n.created_at DESC LIMIT 80`,
    [me.id, show === 'replies' ? REPLIES : show === 'market' ? MARKET : null],
  );
  // Opening this page counts as reading them; the unread ones still show highlighted this once.
  await q('UPDATE notifications SET read_at = now() WHERE member_id = $1 AND read_at IS NULL', [me.id]);

  return (
    <>
      <div className="page-head"><h1 className="title">Alerts</h1></div>
      <SortTabs label="Show" current={show} items={[
        { id: 'all', name: 'All', href: '/alerts' },
        { id: 'replies', name: 'Replies', href: '/alerts?show=replies' },
        { id: 'market', name: 'Market', href: '/alerts?show=market' },
      ]} />
      {alerts.length ? (
        <ul className="rows alert-rows">
          {alerts.map((a, i) => (
            <li key={a.id}>
              {(i === 0 || bucket(alerts[i - 1].created_at) !== bucket(a.created_at)) && <span className="day mono mute">{bucket(a.created_at)}</span>}
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
