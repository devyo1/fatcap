import Link from 'next/link';
import { one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { changePassword, saveProfile } from '@/app/actions';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';

export const metadata = { title: 'Edit profile' };

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const me = await requireUser();
  const { error, saved } = await searchParams;
  const row = await one<{ bio: string | null }>('SELECT bio FROM members WHERE id = $1', [me.id]);

  return (
    <>
      <div className="page-head">
        <div className="who-head">
          <Avatar name={me.username} size={52} />
          <div>
            <h1 className="title">Edit profile</h1>
            <p className="mono mute stat-line"><Link href={`/u/${encodeURIComponent(me.username)}`}>View your profile &rarr;</Link></p>
          </div>
        </div>
      </div>
      <Notice error={error} ok={saved === 'bio' ? 'Profile saved.' : saved === 'password' ? 'Password changed.' : undefined} />

      <div className="grid2" style={{ marginTop: 18 }}>
        <section className="box">
          <div className="bh mono"><span className="br">About you</span></div>
          <div className="bb">
            <form action={saveProfile} className="stack">
              <div className="field">
                <label className="mono" htmlFor="bio">Bio</label>
                <textarea className="textarea" id="bio" name="bio" rows={4} maxLength={300} defaultValue={row?.bio ?? ''} placeholder="A line or two. Shows on your profile." />
                <span className="hint mono">300 characters max. Links and @names work.</span>
              </div>
              <div className="actions"><button className="btn solid" type="submit">Save</button></div>
            </form>
          </div>
        </section>

        <section className="box">
          <div className="bh mono"><span className="br">Password</span></div>
          <div className="bb">
            <form action={changePassword} className="stack">
              <div className="field"><label className="mono" htmlFor="current">Current</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" required /></div>
              <div className="field"><label className="mono" htmlFor="password">New</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" required /></div>
              <div className="field"><label className="mono" htmlFor="confirm">New again</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
              <div className="actions"><button className="btn" type="submit">Change password</button></div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
