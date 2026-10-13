import Bar from '@/components/Bar';
import PullToRefresh from '@/components/PullToRefresh';
import Drafts from '@/components/Drafts';
import Lightbox from '@/components/Lightbox';
import MentionAssist from '@/components/MentionAssist';
import Popovers from '@/components/Popovers';
import { requireUser } from '@/lib/auth';
import { unreadCounts } from '@/lib/counts';
import { purgeExpired } from '@/lib/threads';
import { settleAuctions } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  // Housekeeping, throttled: vanished threads get deleted for real; finished auctions become deals.
  await purgeExpired().catch(() => {});
  await settleAuctions().catch(() => {});
  const counts = await unreadCounts(me.id);
  return (
    <PullToRefresh>
      <Bar me={me} counts={counts} />
      <main className="wrap">{children}</main>
      <Drafts />
      <MentionAssist />
      <Lightbox />
      <Popovers />
    </PullToRefresh>
  );
}
