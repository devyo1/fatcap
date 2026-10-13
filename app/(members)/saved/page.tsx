import { requireUser } from '@/lib/auth';
import { savedThreads } from '@/lib/threads';
import ThreadRows from '@/components/ThreadRows';

export const metadata = { title: 'Saved' };

export default async function Saved() {
  const me = await requireUser();
  const rows = await savedThreads(me);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">Saved</h1>
          <p className="mono mute stat-line">Only you see this.</p>
        </div>
      </div>
      <ThreadRows rows={rows} showBoard empty="Nothing saved." />
    </>
  );
}
