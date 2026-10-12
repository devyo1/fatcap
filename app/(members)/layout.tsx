import Bar from '@/components/Bar';
import { requireUser } from '@/lib/auth';
import { unreadCounts } from '@/lib/counts';

export const dynamic = 'force-dynamic';

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const counts = await unreadCounts(me.id);
  return (
    <>
      <Bar me={me} counts={counts} />
      <main className="wrap">{children}</main>
    </>
  );
}
