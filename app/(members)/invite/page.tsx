import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { memberInvite, inviteUrl } from '@/lib/invites';
import { stickerSvg, DOTS, isDot, isPaper, type Dot, type Paper } from '@/lib/sticker';
import { date } from '@/lib/format';
import { CopyButton, ShareButton } from '@/components/Buttons';

export const metadata = { title: 'Invite' };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ dot?: string; paper?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const dot: Dot = isDot(sp.dot) ? sp.dot : 'orange';
  const paper: Paper = isPaper(sp.paper) ? sp.paper : 'ink';
  const invite = await memberInvite(me.id);
  const url = inviteUrl(invite.code);
  const used = !!invite.used_by;
  const link = (d: Dot, p: Paper) => `/invite?dot=${d}&paper=${p}`;
  const file = (format: 'png' | 'svg') => `/api/sticker?format=${format}&dot=${dot}&paper=${paper}&download=1`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">Invite</h1>
          <p className="mono mute stat-line">Single use / {used ? 'used' : 'unused'}</p>
        </div>
      </div>

      {used ? (
        <div className="invite-used">
          <p>
            Used by{' '}
            {invite.used_by_name ? <Link className="dot" href={`/u/${encodeURIComponent(invite.used_by_name)}`}>{invite.used_by_name}</Link> : 'someone'}
            {invite.used_at ? <> on {date(invite.used_at)}</> : null}.
          </p>
        </div>
      ) : (
        <div className="invite">
          <figure className="sticker-wrap" dangerouslySetInnerHTML={{ __html: stickerSvg({ url, code: invite.code, dot, paper }) }} />

          <div className="invite-side">
            <p className="invite-lede">Single-use code for one person. Download it as a sticker or share the link.</p>

            <div className="field">
              <span className="lbl mono">Dot</span>
              <div className="swatches">
                {(Object.keys(DOTS) as Dot[]).map((d) => (
                  <Link key={d} href={link(d, paper)} className="swatch" aria-label={d} aria-current={d === dot ? 'true' : undefined} style={{ background: DOTS[d] }} replace scroll={false} />
                ))}
              </div>
            </div>
            <div className="field">
              <span className="lbl mono">Paper</span>
              <div className="seg mono">
                <Link href={link(dot, 'ink')} aria-current={paper === 'ink' ? 'true' : undefined} replace scroll={false}>Black</Link>
                <Link href={link(dot, 'bone')} aria-current={paper === 'bone' ? 'true' : undefined} replace scroll={false}>Bone</Link>
              </div>
            </div>

            <div className="actions">
              <a className="btn solid" href={file('png')} download>Download PNG</a>
              <a className="btn" href={file('svg')} download>SVG</a>
            </div>
            <div className="actions">
              <ShareButton url={url} />
              <CopyButton text={url} />
            </div>
            <p className="mono mute code-line">{url}</p>
          </div>
        </div>
      )}
    </>
  );
}
