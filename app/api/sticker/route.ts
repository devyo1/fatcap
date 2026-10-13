import sharp from 'sharp';
import { currentUser } from '@/lib/auth';
import { findInvite, memberInvite, inviteUrl } from '@/lib/invites';
import { stickerSvg, isDot, isPaper } from '@/lib/sticker';

export const dynamic = 'force-dynamic';

/**
 * Invite sticker as SVG or PNG. Members get their own; admins can pull any unused code (for the print sheet).
 *   /api/sticker?format=png&dot=orange&paper=ink&download=1[&code=XXXX]
 */
export async function GET(req: Request) {
  const me = await currentUser({ touch: false });
  if (!me) return new Response('Not found', { status: 404 });
  const p = new URL(req.url).searchParams;
  const want = p.get('code')?.toUpperCase();

  const invite = want && me.is_admin ? await findInvite(want) : await memberInvite(me.id);
  if (!invite || invite.used_at || invite.revoked) return new Response('That invite is used up.', { status: 410 });

  const svg = stickerSvg({
    url: inviteUrl(invite.code),
    code: invite.code,
    dot: isDot(p.get('dot')) ? (p.get('dot') as never) : undefined,
    paper: isPaper(p.get('paper')) ? (p.get('paper') as never) : undefined,
  });
  const png = p.get('format') === 'png';
  const name = `fatcap-invite-${invite.code}.${png ? 'png' : 'svg'}`;
  const headers: Record<string, string> = {
    'Content-Type': png ? 'image/png' : 'image/svg+xml',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Disposition': `${p.get('download') ? 'attachment' : 'inline'}; filename="${name}"`,
  };
  // 4x for print: about 1600 px wide, crisp at sticker sizes.
  const body = png ? new Uint8Array(await sharp(Buffer.from(svg), { density: 288 }).png().toBuffer()) : svg;
  return new Response(body, { headers });
}
