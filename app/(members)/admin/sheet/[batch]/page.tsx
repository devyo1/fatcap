import Link from 'next/link';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { inviteUrl, qrSvg } from '@/lib/invites';
import { revokeInvite } from '@/app/actions';
import { PrintButton } from '@/components/Buttons';
import './sheet.css';

export const metadata = { title: 'Sticker sheet' };

export default async function Sheet({ params, searchParams }: { params: Promise<{ batch: string }>; searchParams: Promise<{ all?: string }> }) {
  await requireAdmin();
  const batch = decodeURIComponent((await params).batch);
  const all = (await searchParams).all === '1';
  const codes = await q<{ id: number; code: string; used_at: string | null; revoked: boolean }>(
    `SELECT id, code, used_at, revoked FROM invites WHERE kind = 'sticker' AND batch = $1 ORDER BY id`,
    [batch],
  );
  const shown = all ? codes : codes.filter((c) => !c.used_at && !c.revoked);
  const svgs = await Promise.all(shown.map((c) => qrSvg(inviteUrl(c.code), { dark: '#000000', light: '#ffffff' })));
  const here = `/admin/sheet/${encodeURIComponent(batch)}`;

  return (
    <>
      <div className="head no-print">
        <div>
          <h1 className="wide h2">{batch}</h1>
          <p className="sub mono mute">{shown.length} {all ? 'codes' : 'unused codes'} / each works once</p>
        </div>
        <div className="actions">
          <Link className="mono mute" href={all ? here : `${here}?all=1`}>{all ? 'Unused only' : 'Show used too'}</Link>
          <PrintButton />
        </div>
      </div>

      <div className="sheet">
        {shown.map((c, i) => (
          <div className="cell" key={c.id}>
            <div className={`sticker${c.used_at || c.revoked ? ' spent' : ''}`}>
              <div className="sq" dangerouslySetInnerHTML={{ __html: svgs[i] }} />
              <div className="lab">
                <span className="wm">Fatcap<span className="d">.</span>club</span>
                <span className="cd">{c.code}</span>
              </div>
            </div>
            <div className="meta no-print mono">
              {c.used_at || c.revoked ? (
                <span className="mute">{c.revoked ? 'Revoked' : 'Used'}</span>
              ) : (
                <form action={revokeInvite}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="back" value={here} />
                  <button className="linkbtn mono mute" type="submit" title="Kill this code if a sticker gets lost">Revoke</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
