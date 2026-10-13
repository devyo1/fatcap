import Link from 'next/link';
import { cookies } from 'next/headers';
import { q, one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ago, date } from '@/lib/format';
import { makeStickers, resetPassword, resolveReport } from '@/app/actions';
import { banMember, unbanMember, toggleAdmin, wipeMemberPosts, moderate, removeMock, addMock } from '@/app/admin-actions';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';
import RichText from '@/components/RichText';

export const metadata = { title: 'Admin' };

const TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'members', name: 'Members' },
  { id: 'reports', name: 'Reports' },
  { id: 'moderation', name: 'Moderation' },
  { id: 'stickers', name: 'Stickers' },
  { id: 'tree', name: 'Invite tree' },
] as const;
type Tab = (typeof TABS)[number]['id'];

type Member = {
  id: number; username: string; created_at: string; last_seen_at: string | null; banned: boolean; ban_reason: string | null;
  banned_at: string | null; is_admin: boolean; is_mock: boolean;
  via_kind: string | null; via_batch: string | null; inviter_id: number | null; inviter: string | null;
  threads: number; replies: number;
};

async function members(search = '') {
  return q<Member>(
    `SELECT u.id, u.username, u.created_at, u.last_seen_at, u.banned, u.ban_reason, u.banned_at, u.is_admin, u.is_mock,
            i.kind AS via_kind, i.batch AS via_batch,
            CASE WHEN i.kind = 'member' THEN i.created_by END AS inviter_id, inv.username AS inviter,
            (SELECT count(*)::int FROM threads WHERE user_id = u.id AND NOT deleted) AS threads,
            (SELECT count(*)::int FROM posts WHERE user_id = u.id AND NOT deleted) AS replies
       FROM members u
       LEFT JOIN invites i ON i.id = u.invited_via
       LEFT JOIN members inv ON inv.id = i.created_by AND i.kind = 'member'
      WHERE $1 = '' OR u.username_key LIKE '%' || $1 || '%'
      ORDER BY u.banned, u.created_at DESC`,
    [search.toLowerCase()],
  );
}

function Hidden({ id }: { id: number }) {
  return <input type="hidden" name="id" value={id} />;
}

/* ---------- sections ---------- */

async function Overview() {
  const s = await one<Record<string, number>>(
    `SELECT (SELECT count(*)::int FROM members WHERE NOT banned) AS members,
            (SELECT count(*)::int FROM members WHERE banned) AS banned,
            (SELECT count(*)::int FROM members WHERE is_mock) AS mock,
            (SELECT count(*)::int FROM members WHERE created_at > now() - interval '7 days') AS joined_week,
            (SELECT count(*)::int FROM members WHERE last_seen_at > now() - interval '24 hours' AND NOT banned) AS active_day,
            (SELECT count(*)::int FROM threads WHERE NOT deleted) AS threads,
            (SELECT count(*)::int FROM posts WHERE NOT deleted) AS comments,
            (SELECT count(*)::int FROM messages) AS messages,
            (SELECT count(*)::int FROM invites WHERE kind = 'sticker' AND used_at IS NULL AND NOT revoked) AS stickers_open,
            (SELECT count(*)::int FROM invites WHERE kind = 'sticker' AND used_at IS NOT NULL) AS stickers_used`,
  );
  const tiles: [string, number, string?][] = [
    ['Members', s?.members ?? 0], ['Active today', s?.active_day ?? 0], ['Joined this week', s?.joined_week ?? 0], ['Banned', s?.banned ?? 0],
    ['Threads', s?.threads ?? 0], ['Comments', s?.comments ?? 0], ['Private messages', s?.messages ?? 0],
    ['Stickers out there', s?.stickers_open ?? 0], ['Stickers redeemed', s?.stickers_used ?? 0],
  ];
  return (
    <>
      <div className="tiles">
        {tiles.map(([label, n]) => <div className="tile" key={label}><b>{n}</b><span className="mono mute">{label}</span></div>)}
      </div>
      <div className="box" style={{ marginTop: 32 }}>
        <div className="bh mono"><span className="br">Mock content</span><span className="mute">{s?.mock ?? 0} mock members</span></div>
        <div className="bb">
          <p style={{ marginTop: 0 }}>Fake members and posts that make the forum look alive: threads in every sub-forum, Market listings, deals and pictures. Adding only fills in what's missing. Removing deletes those members and everything they posted.</p>
          <div className="actions">
            <form action={addMock}><button className="btn" type="submit">Add mock content</button></form>
            <form action={removeMock}><button className="btn danger" type="submit" disabled={!s?.mock}>Remove all mock content</button></form>
          </div>
        </div>
      </div>
    </>
  );
}

async function Members({ search, meId }: { search: string; meId: number }) {
  const list = await members(search);
  return (
    <>
      <form className="searchbar" action="/admin" role="search" style={{ marginTop: 0 }}>
        <input type="hidden" name="tab" value="members" />
        <label className="sr" htmlFor="s">Find a member</label>
        <input className="input" id="s" name="s" defaultValue={search} placeholder="Find a member" autoComplete="off" />
        <button className="btn" type="submit">Find</button>
      </form>
      <ul className="mod-list">
        {list.map((m) => (
          <li key={m.id} className={m.banned ? 'banned' : ''}>
            <div className="mod-who">
              <Avatar name={m.username} size={34} />
              <div>
                <Link className="who" href={`/u/${encodeURIComponent(m.username)}`}>{m.username}</Link>{' '}
                {m.is_admin && <span className="pill on">Admin</span>} {m.is_mock && <span className="pill">Mock</span>} {m.banned && <span className="pill ban">Banned</span>}
                <p className="mono mute">
                  Joined {date(m.created_at)} / {m.inviter ? `via ${m.inviter}` : m.via_kind === 'sticker' ? `sticker${m.via_batch ? ` (${m.via_batch})` : ''}` : 'founder'} / {m.threads + m.replies} posts / {m.last_seen_at ? `seen ${ago(m.last_seen_at)}` : 'never seen'}
                </p>
                {m.banned && <p className="mono ban-note">Banned {m.banned_at ? ago(m.banned_at) : ''}{m.ban_reason ? `: ${m.ban_reason}` : ''}</p>}
              </div>
            </div>
            {m.id !== meId && (
              <div className="acts">
                {m.banned ? (
                  <form action={unbanMember}><Hidden id={m.id} /><button className="chip" type="submit">Unban</button></form>
                ) : !m.is_admin && (
                  <details className="pop">
                    <summary className="chip danger">Ban</summary>
                    <form action={banMember} className="stack inline-form">
                      <Hidden id={m.id} />
                      <label className="mono mute" htmlFor={`why${m.id}`}>Reason (shown to admins only)</label>
                      <input className="input" id={`why${m.id}`} name="reason" maxLength={200} placeholder="Optional" />
                      <div className="actions"><button className="btn small danger" type="submit">Ban {m.username}</button></div>
                    </form>
                  </details>
                )}
                {!m.is_admin && (
                  <details className="pop">
                    <summary className="chip">Hide all posts</summary>
                    <form action={wipeMemberPosts} className="stack inline-form">
                      <Hidden id={m.id} />
                      <p className="mute" style={{ margin: 0 }}>Hides every thread and comment by {m.username}. You can restore single posts from Moderation.</p>
                      <div className="actions"><button className="btn small danger" type="submit">Hide everything</button></div>
                    </form>
                  </details>
                )}
                {!m.is_admin && <form action={resetPassword}><Hidden id={m.id} /><button className="chip" type="submit">Reset password</button></form>}
                {!m.banned && <form action={toggleAdmin}><Hidden id={m.id} /><button className="chip" type="submit">{m.is_admin ? 'Remove admin' : 'Make admin'}</button></form>}
              </div>
            )}
          </li>
        ))}
        {!list.length && <li className="empty mono">No one matches.</li>}
      </ul>
    </>
  );
}

async function Moderation({ show }: { show: string }) {
  const rows = await q<{ kind: 'thread' | 'post'; id: number; thread_id: number; title: string; body: string; author: string | null; deleted: boolean; created_at: string }>(
    `SELECT * FROM (
       (SELECT 'thread' AS kind, t.id, t.id AS thread_id, t.title, t.body, u.username AS author, t.deleted, t.created_at
          FROM threads t LEFT JOIN members u ON u.id = t.user_id)
       UNION ALL
       (SELECT 'post', p.id, t.id, t.title, p.body, u.username, p.deleted, p.created_at
          FROM posts p JOIN threads t ON t.id = p.thread_id LEFT JOIN members u ON u.id = p.user_id)
     ) x WHERE ($1 = 'all' OR ($1 = 'hidden' AND deleted) OR ($1 = 'live' AND NOT deleted))
     ORDER BY created_at DESC LIMIT 80`,
    [show],
  );
  return (
    <>
      <nav className="subtabs mono" aria-label="Filter">
        {[['live', 'Live'], ['hidden', 'Hidden'], ['all', 'Everything']].map(([id, name]) => (
          <Link key={id} href={`/admin?tab=moderation&show=${id}`} aria-current={show === id ? 'page' : undefined}>{name}</Link>
        ))}
      </nav>
      <ul className="mod-list">
        {rows.map((r) => (
          <li key={`${r.kind}${r.id}`} className={r.deleted ? 'banned' : ''}>
            <div className="mod-who">
              <Avatar name={r.author} size={30} />
              <div style={{ minWidth: 0 }}>
                <p className="mono mute">
                  <b className="who">{r.author ?? 'gone'}</b> / {r.kind === 'thread' ? 'started' : 'commented in'}{' '}
                  <Link href={`/forum/t/${r.thread_id}${r.kind === 'post' ? `#p${r.id}` : ''}`}>{r.title}</Link> / {ago(r.created_at)}
                  {r.deleted && <> / <span className="ban-note">hidden</span></>}
                </p>
                <RichText className="body mod-body" text={r.body.length > 280 ? `${r.body.slice(0, 280)}...` : r.body} />
              </div>
            </div>
            <form action={moderate} className="acts">
              <input type="hidden" name="kind" value={r.kind} />
              <Hidden id={r.id} />
              <input type="hidden" name="do" value={r.deleted ? 'show' : 'hide'} />
              <button className={`chip${r.deleted ? '' : ' danger'}`} type="submit">{r.deleted ? 'Restore' : 'Hide'}</button>
            </form>
          </li>
        ))}
        {!rows.length && <li className="empty mono">Nothing here.</li>}
      </ul>
    </>
  );
}

async function Reports() {
  const rows = await q<{
    id: number; reason: string; note: string | null; created_at: string; reporter: string | null;
    thread_id: number; post_id: number | null; title: string; body: string; author: string | null; deleted: boolean;
  }>(
    `SELECT r.id, r.reason, r.note, r.created_at, rm.username AS reporter, r.thread_id, r.post_id, t.title,
            COALESCE(p.body, t.body) AS body, COALESCE(pu.username, tu.username) AS author, COALESCE(p.deleted, t.deleted) AS deleted
       FROM reports r
       JOIN threads t ON t.id = r.thread_id
       LEFT JOIN posts p ON p.id = r.post_id
       LEFT JOIN members rm ON rm.id = r.member_id
       LEFT JOIN members tu ON tu.id = t.user_id
       LEFT JOIN members pu ON pu.id = p.user_id
      WHERE r.resolved_at IS NULL
      ORDER BY r.created_at DESC LIMIT 100`,
  );
  return (
    <ul className="mod-list">
      {rows.map((r) => (
        <li key={r.id}>
          <div className="mod-who">
            <Avatar name={r.author} size={30} />
            <div style={{ minWidth: 0 }}>
              <p className="mono mute">
                <span className="pill on">{r.reason}</span> {r.post_id ? 'Comment' : 'Thread'} by <b className="who">{r.author ?? 'gone'}</b> in{' '}
                <Link href={`/forum/t/${r.thread_id}${r.post_id ? `#p${r.post_id}` : ''}`}>{r.title}</Link> / reported by {r.reporter ?? 'gone'} {ago(r.created_at)}
                {r.deleted && <> / <span className="ban-note">hidden</span></>}
              </p>
              {r.note && <p className="mod-note">{r.note}</p>}
              <RichText className="body mod-body" text={r.body.length > 280 ? `${r.body.slice(0, 280)}...` : r.body} />
            </div>
          </div>
          <div className="acts">
            {!r.deleted && (
              <form action={resolveReport}><Hidden id={r.id} /><input type="hidden" name="hide" value="1" /><button className="chip danger" type="submit">Hide + close</button></form>
            )}
            <form action={resolveReport}><Hidden id={r.id} /><button className="chip" type="submit">Close</button></form>
          </div>
        </li>
      ))}
      {!rows.length && <li className="empty mono">No open reports.</li>}
    </ul>
  );
}

async function Stickers() {
  const batches = await q<{ batch: string; created: string; total: number; used: number; revoked: number }>(
    `SELECT batch, min(created_at) AS created, count(*)::int AS total,
            count(used_at)::int AS used, count(*) FILTER (WHERE revoked)::int AS revoked
       FROM invites WHERE kind = 'sticker' GROUP BY batch ORDER BY min(created_at) DESC`,
  );
  return (
    <div className="grid2">
      <form action={makeStickers} className="box">
        <div className="bh mono"><span>New batch</span><span className="mute">One-time QR codes</span></div>
        <div className="bb stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label className="mono" htmlFor="batch">Batch name</label><input className="input" id="batch" name="batch" placeholder="e.g. plateau drop" maxLength={40} /></div>
          <div className="field"><label className="mono" htmlFor="count">How many</label><input className="input" id="count" name="count" type="number" inputMode="numeric" min={1} max={200} defaultValue={24} required /></div>
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
  );
}

function TreeList({ nodes, kids }: { nodes: Member[]; kids: Map<number, Member[]> }) {
  return (
    <ul>
      {nodes.map((m) => (
        <li key={m.id}>
          <span className="node">
            <Avatar name={m.username} size={18} />
            <Link href={`/u/${encodeURIComponent(m.username)}`}>{m.username}</Link>
            <span className="mono mute">{date(m.created_at)}</span>
            {m.banned && <span className="pill ban">Banned</span>}
          </span>
          {kids.get(m.id)?.length ? <TreeList nodes={kids.get(m.id)!} kids={kids} /> : null}
        </li>
      ))}
    </ul>
  );
}

async function Tree() {
  const list = (await members()).reverse();
  const kids = new Map<number, Member[]>();
  const roots = new Map<string, Member[]>();
  for (const m of list) {
    if (m.inviter_id) kids.set(m.inviter_id, [...(kids.get(m.inviter_id) ?? []), m]);
    else {
      const key = m.via_kind === 'sticker' ? `Sticker / ${m.via_batch ?? 'no batch'}` : m.is_mock ? 'Mock' : 'Founders';
      roots.set(key, [...(roots.get(key) ?? []), m]);
    }
  }
  return (
    <div className="tree">
      {[...roots.entries()].map(([label, nodes]) => (
        <div className="root" key={label}>
          <span className="mono mute">{label}</span>
          <TreeList nodes={nodes} kids={kids} />
        </div>
      ))}
    </div>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; ok?: string; s?: string; show?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === sp.tab)?.id ?? 'overview') as Tab;
  const open = (await one<{ n: number }>('SELECT count(*)::int AS n FROM reports WHERE resolved_at IS NULL'))?.n ?? 0;
  let flash: { user?: string; temp?: string } | null = null;
  try { flash = JSON.parse((await cookies()).get('fc_flash')?.value ?? 'null'); } catch {}

  return (
    <>
      <div className="head">
        <h1 className="title">Admin</h1>
      </div>
      <nav className="subtabs mono big" aria-label="Admin sections">
        {TABS.map((t) => <Link key={t.id} href={`/admin?tab=${t.id}`} aria-current={tab === t.id ? 'page' : undefined}>{t.name}{t.id === 'reports' && open ? <span className="count">{open}</span> : null}</Link>)}
      </nav>
      <Notice error={sp.error} ok={sp.ok} />
      {flash?.temp && (
        <p className="notice mono" role="status">
          Temporary password for {flash.user}: <code>{flash.temp}</code>. Send it to them; they can change it on their profile. This disappears in a minute.
        </p>
      )}
      <div className="section" style={{ marginTop: 22 }}>
        {tab === 'overview' && <Overview />}
        {tab === 'members' && <Members search={sp.s ?? ''} meId={me.id} />}
        {tab === 'reports' && <Reports />}
        {tab === 'moderation' && <Moderation show={['live', 'hidden', 'all'].includes(sp.show ?? '') ? sp.show! : 'live'} />}
        {tab === 'stickers' && <Stickers />}
        {tab === 'tree' && <Tree />}
      </div>
    </>
  );
}
