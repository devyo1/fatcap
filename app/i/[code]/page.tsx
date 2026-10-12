import Link from 'next/link';
import { findInvite } from '@/lib/invites';
import { currentUser } from '@/lib/auth';
import { LIMITS } from '@/lib/config';
import { redeemInvite } from '@/app/actions';
import Notice from '@/components/Notice';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invite' };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string }> }) {
  const code = (await params).code.toUpperCase();
  const { error } = await searchParams;
  const [invite, me] = await Promise.all([findInvite(code), currentUser()]);
  const open = invite && !invite.used_at && !invite.revoked;

  return (
    <div className="gate">
      <div className="card">
        <span className="mono mute br">Invite / {code.slice(0, 4)}&hellip;</span>
        {me ? (
          <>
            <h1 className="wide big">Already in</h1>
            <p>You're signed in as {me.username}. Pass this one on.</p>
            <Link className="btn solid" href="/forum">Enter</Link>
          </>
        ) : !open ? (
          <>
            <h1 className="wide big">Gone</h1>
            <p className="mute">This invite has already been used, or it never existed.</p>
            <Link className="mono mute" href="/">fatcap.club</Link>
          </>
        ) : (
          <>
            <h1 className="wide big">You found one<span className="dot">.</span></h1>
            <p className="mute">This works once. Pick a username and a password.</p>
            <Notice error={error} />
            <form action={redeemInvite} className="stack" style={{ marginTop: 18 }}>
              <input type="hidden" name="code" value={code} />
              <div className="field">
                <label className="mono" htmlFor="username">Username</label>
                <input className="input" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
                  minLength={LIMITS.username[0]} maxLength={LIMITS.username[1]} pattern="[A-Za-z0-9_.\-]+" required />
              </div>
              <div className="field">
                <label className="mono" htmlFor="password">Password</label>
                <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={LIMITS.password} required />
              </div>
              <div className="field">
                <label className="mono" htmlFor="confirm">Password again</label>
                <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={LIMITS.password} required />
              </div>
              <div className="actions"><button className="btn solid" type="submit">Join</button></div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
