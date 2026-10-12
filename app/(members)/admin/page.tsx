import Link from 'next/link';
import { cookies } from 'next/headers';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ago, date } from '@/lib/format';
import { makeStickers, toggleBan, resetPassword } from '@/app/actions';
import Notice from '@/components/Notice';

export const metadata = { title: 'Admin' };

type Batch = { batch: string; created: string; total: number; used: number; revoked: number };
type Member = {
  id: number; username: string; created_at: string; last_seen_at: string | null; banned: boolean; is_admin: boolean;
  via_kind: string | null; via_batch: string | null; inviter_id: number | null; inviter: string | null;
  threads: number; replies: number;
};

function Tree({ nodes, kids }: { nodes: Member[]; kids: Map<number, Member[]> }) {
  return (
    <ul>
      {nodes.map((m) => (
        <li key={m.id}>
          <span className="node">
            <Link href={`/u/${encodeURIComponent(m.username)}`}>{m.username}</Link>
            <span className="mono mute">{date(m.created_at)}</span>
            {m.banned && <span className="pill">Banned</span>}
          </span>
          {kids.get(m.id)?.length ? <Tree nodes={kids.get(m.id)!} kids={kids} /> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireAdmin();
  const { error } = await searchParams;
  let flash: { user?: string; temp?: string } | null = null;
  try { flash = JSON.parse((await cookies()).get('fc_flash')?.value ?? 'null'); } catch {}

  const [batches, members] = await Promise.all([
    q<Batch>(
      `SELECT batch, min(created_at) AS created, count(*)::int AS total,
              count(used_at)::int AS used, count(*) FILTER (WHERE revoked)::int AS revoked
         FROM invites WHERE kind = 'sticker' GROUP BY batch ORDER BY min(created_at) DESC`,
    ),
    q<Member>(
      `SELECT u.id, u.username, u.created_at, u.last_seen_at, u.banned, u.is_admin,
              i.kind AS via_kind, i.batch AS via_batch,
              CASE WHEN i.kind = 'member' THEN i.created_by END AS inviter_id, inv.username AS inviter,
              (SELECT count(*)::int FROM threads WHERE user_id = u.id AND NOT deleted) AS threads,
              (SELECT count(*)::int FROM posts WHERE user_id = u.id AND NOT deleted) AS replies
         FROM users u
         LEFT JOIN invites i ON i.id = u.invited_via
         LEFT JOIN users inv ON inv.id = i.created_by AND i.kind = 'member'
        ORDER BY u.created_at`,
    ),
  ]);

  // Invite tree: members hang under whoever invited them; stickers start new branches.
  const kids = new Map<number, Member[]>();
  const roots = new Map<string, Member[]>();
  for (const m of members) {
    if (m.inviter_id) kids.set(m.inviter_id, [...(kids.get(m.inviter_id) ?? []), m]);
    else {
      const key = m.via_kind === 'sticker' ? `Sticker / ${m.via_batch ?? 'no batch'}` : 'Founder';
      roots.set(key, [...(roots.get(key) ?? []), m]);
    }
  }

  return (
    <>
      <div className="head">
        <h1 className="wide h1">Admin</h1>
        <span className="mono mute">{members.length} members</span>
      </div>
      <Notice error={error} />
      {flash?.temp && (
        <p className="notice mono" role="status">
          Temporary password for {flash.user}: <code>{flash.temp}</code>. Send it to them; they can change it on their profile. This disappears in a minute.
        </p>
      )}

      <section className="section">
        <span className="mono mute br">Stickers</span>
        <div className="grid2">
          <form action={makeStickers} className="box">
            <div className="bh mono"><span>New batch</span><span className="mute">One-time QR codes</span></div>
            <div className="bb stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field"><label className="mono" htmlFor="batch">Batch name</label><input className="input" id="batch" name="batch" placeholder="e.g. east side drop" maxLength={40} /></div>
              <div className="field"><label className="mono" htmlFor="count">How many</label><input className="input" id="count" name="count" type="number" min={1} max={200} defaultValue={24} required /></div>
              <div className="actions"><button className="btn solid" type="submit">Make + open sheet</button></div>
            </div>
          </form>
          <div>
            {batches.length ? (
              <div className="table-wrap">
                <table style={{ minWidth: 420 }}>
                  <thead><tr><th>Batch</th><th>Made</th><th>Used</th><th></th></tr></thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.batch}>
                        <td>{b.batch}</td>
                        <td className="mono mute">{date(b.created)}</td>
                        <td className="num">{b.used} / {b.total - b.revoked}</td>
                        <td><Link className="mono" href={`/admin/sheet/${encodeURIComponent(b.batch)}`}>Sheet &rarr;</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="empty mono">No stickers yet.</p>}
          </div>
        </div>
      </section>

      <section className="section" id="members">
        <span className="mono mute br">Members</span>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Username</th><th>Joined</th><th>Via</th><th>Posts</th><th>Seen</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/u/${encodeURIComponent(m.username)}`}>{m.username}</Link>{' '}
                    {m.is_admin && <span className="pill on">Admin</span>} {m.banned && <span className="pill">Banned</span>}
                  </td>
                  <td className="mono mute">{date(m.created_at)}</td>
                  <td className="mute">{m.inviter ? `@${m.inviter}` : m.via_kind === 'sticker' ? `Sticker${m.via_batch ? ` / ${m.via_batch}` : ''}` : 'Founder'}</td>
                  <td className="num">{m.threads + m.replies}</td>
                  <td className="mono mute">{m.last_seen_at ? ago(m.last_seen_at) : '-'}</td>
                  <td>
                    {m.id !== me.id && !m.is_admin && (
                      <div className="actions" style={{ flexWrap: 'nowrap' }}>
                        <form action={resetPassword}><input type="hidden" name="id" value={m.id} /><button className="btn small" type="submit">Reset password</button></form>
                        <form action={toggleBan}><input type="hidden" name="id" value={m.id} /><button className="btn small danger" type="submit">{m.banned ? 'Unban' : 'Ban'}</button></form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <span className="mono mute br">Invite tree</span>
        <div className="tree">
          {[...roots.entries()].map(([label, nodes]) => (
            <div className="root" key={label}>
              <span className="mono mute">{label}</span>
              <Tree nodes={nodes} kids={kids} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
