import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import { LIMITS } from '@/lib/config';
import { setupAdmin } from '@/app/actions';
import Notice from '@/components/Notice';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Setup' };

// One-time: creates the first (admin) account. Needs ?token=SETUP_TOKEN and an empty users table.
export default async function Setup({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const expected = process.env.SETUP_TOKEN;
  if (!expected || token !== expected) notFound();
  if (await one('SELECT 1 FROM members LIMIT 1')) notFound();

  return (
    <div className="gate">
      <div className="card">
        <span className="mono mute br">Setup</span>
        <h1 className="wide big">First account<span className="dot">.</span></h1>
        <p className="mute">This becomes the admin. The page stops working once it exists.</p>
        <Notice error={error} />
        <form action={setupAdmin} className="stack" style={{ marginTop: 18 }}>
          <input type="hidden" name="token" value={token} />
          <div className="field"><label className="mono" htmlFor="username">Username</label><input className="input" id="username" name="username" autoComplete="username" autoCapitalize="none" maxLength={LIMITS.username[1]} required /></div>
          <div className="field"><label className="mono" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={LIMITS.password} required /></div>
          <div className="field"><label className="mono" htmlFor="confirm">Password again</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={LIMITS.password} required /></div>
          <div className="actions"><button className="btn solid" type="submit">Create admin</button></div>
        </form>
      </div>
    </div>
  );
}
