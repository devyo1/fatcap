import Bar from '@/components/Bar';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  return (
    <>
      <Bar me={me} />
      <main className="wrap">{children}</main>
    </>
  );
}
