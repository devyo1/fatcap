import Bar from '@/components/Bar';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import Drafts from '@/components/Drafts';
import Lightbox from '@/components/Lightbox';
import MentionAssist from '@/components/MentionAssist';
import Popovers from '@/components/Popovers';
import PhoneUX from '@/components/PhoneUX';
import { AvatarProvider } from '@/components/Avatar';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { unreadCounts } from '@/lib/counts';
import { purgeExpired } from '@/lib/threads';
import { settleAuctions } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  // Housekeeping, throttled: vanished threads get deleted for real; finished auctions become deals.
  await purgeExpired().catch(() => {});
  await settleAuctions().catch(() => {});
  const [counts, pics] = await Promise.all([
    unreadCounts(me.id),
    // Who has a profile picture (and which version), so avatars can show it without asking per face.
    q<{ k: string; v: number }>('SELECT m.username_key AS k, extract(epoch FROM a.updated_at)::bigint AS v FROM avatars a JOIN members m ON m.id = a.member_id WHERE NOT m.banned'),
  ]);
  return (
    <AvatarProvider map={Object.fromEntries(pics.map((p) => [p.k, Number(p.v)]))}>
      <PullToRefresh>
        <Bar me={me} counts={counts} />
        <main className="wrap">{children}</main>
        <Drafts />
        <MentionAssist />
        <Lightbox />
        <Popovers />
        <PhoneUX />
      </PullToRefresh>
      <BottomNav username={me.username} initial={counts} />
    </AvatarProvider>
  );
}
