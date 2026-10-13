import Link from 'next/link';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { inviteUrl } from '@/lib/invites';
import { stickerSvg, isDot, isPaper } from '@/lib/sticker';
import { revokeInvite } from '@/app/actions';
import { PrintButton } from '@/components/Buttons';
import './sheet.css';

export const metadata = { title: 'Sticker sheet' };

export default async function Sheet({ params, searchParams }: { params: Promise<{ batch: string }>; searchParams: Promise<{ all?: string; paper?: string; dot?: string }> }) {
  await requireAdmin();
  const batch = decodeURIComponent((await params).batch);
  const sp = await searchParams;
  const all = sp.all === '1';
  const paper = isPaper(sp.paper) ? sp.paper : 'ink';
  const dot = isDot(sp.dot) ? sp.dot : 'orange';
  const codes = await q<{ id: number; code: string; used_at: string | null; revoked: boolean }>(
    `SELECT id, code, used_at, revoked FROM invites WHERE kind = 'sticker' AND batch = $1 ORDER BY id`,
    [batch],
  );
  const shown = all ? codes : codes.filter((c) => !c.used_at && !c.revoked);
  const svgs = shown.map((c) => stickerSvg({ url: inviteUrl(c.code), code: c.code, paper, dot }));
  const here = `/admin/sheet/${encodeURIComponent(batch)}`;
  const qs = (o: Record<string, string>) => `${here}?${new URLSearchParams({ ...(all ? { all: '1' } : {}), paper, dot, ...o })}`;

  return (
    <>
      <div className="head no-print">
        <div>
          <h1 className="title">{batch}</h1>
          <p className="sub mono mute">{shown.length} {all ? 'codes' : 'unused codes'} / each works once</p>
        </div>
        <div className="actions">
          <Link className="mono mute" href={qs({ paper: paper === 'ink' ? 'bone' : 'ink' })}>{paper === 'ink' ? 'Bone stickers' : 'Black stickers'}</Link>
          <Link className="mono mute" href={all ? `${here}?${new URLSearchParams({ paper, dot })}` : qs({ all: '1' })}>{all ? 'Unused only' : 'Show used too'}</Link>
          <PrintButton />
        </div>
      </div>

      <div className="sheet">
        {shown.map((c, i) => (
          <div className="cell" key={c.id}>
            <div className={`sticker${c.used_at || c.revoked ? ' spent' : ''}`} dangerouslySetInnerHTML={{ __html: svgs[i] }} />
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
