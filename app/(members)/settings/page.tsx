import Link from 'next/link';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { changePassword, saveProfile } from '@/app/actions';
import Avatar from '@/components/Avatar';
import AvatarUpload from '@/components/AvatarUpload';
import { toggleBlock } from '@/app/social-actions';
import Notice from '@/components/Notice';
import CollectionSwitch from '@/components/CollectionSwitch';

export const metadata = { title: 'Edit profile' };

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const me = await requireUser();
  const { error, saved } = await searchParams;
  const [row, pic, blocked] = await Promise.all([
    one<{ bio: string | null; show_collection: boolean }>('SELECT bio, show_collection FROM members WHERE id = $1', [me.id]),
    one('SELECT 1 FROM avatars WHERE member_id = $1', [me.id]),
    q<{ username: string }>('SELECT m.username FROM blocks b JOIN members m ON m.id = b.blocked_id WHERE b.blocker_id = $1 ORDER BY b.created_at DESC', [me.id]),
  ]);

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
          <div className="bh mono"><span className="br">Picture</span></div>
          <div className="bb"><AvatarUpload username={me.username} has={!!pic} /></div>
        </section>

        <section className="box">
          <div className="bh mono"><span className="br">Profile</span></div>
          <div className="bb">
            <form action={saveProfile} className="stack">
              <div className="field">
                <label className="mono" htmlFor="bio">Bio</label>
                <textarea className="textarea" id="bio" name="bio" rows={4} maxLength={300} defaultValue={row?.bio ?? ''} placeholder="Shown on your profile." />
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
        <section className="box">
          <div className="bh mono"><span className="br">Collection</span></div>
          <div className="bb">
            <CollectionSwitch shown={row?.show_collection ?? true} />
            <p className="hint mono">Zines and books you get here sit on a shelf on your profile. Off: only you see it.</p>
          </div>
        </section>

        <section className="box">
          <div className="bh mono"><span className="br">Blocked</span><span className="mute">{blocked.length}</span></div>
          <div className="bb">
            {blocked.length ? (
              <ul className="blocked-list">
                {blocked.map((b) => (
                  <li key={b.username}>
                    <span><Avatar name={b.username} size={22} />{b.username}</span>
                    <form action={toggleBlock}><input type="hidden" name="name" value={b.username} /><input type="hidden" name="back" value="/settings" /><button className="linkbtn mono mute" type="submit">Unblock</button></form>
                  </li>
                ))}
              </ul>
            ) : <p className="mono mute" style={{ margin: 0 }}>No one. Block someone from their profile.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
