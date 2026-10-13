import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { boardBySlug, subBySlug, type Sub } from '@/lib/config';
import { listThreads, topicStats, sortOf, SORTS } from '@/lib/threads';
import { openDeals } from '@/lib/market';
import ThreadRows from '@/components/ThreadRows';
import ListingGrid from '@/components/ListingGrid';
import OpenDeals from '@/components/OpenDeals';
import { SortTabs, SubForums } from '@/components/ForumNav';

/**
 * A board (its sub-forums as rows, then every thread in it), or one sub-forum (a strip to hop
 * between siblings, then its threads). Market shows cards instead of rows.
 */
export default async function BoardView({ boardSlug, subSlug, page: pageParam, sort: sortParam }: { boardSlug: string; subSlug?: string; page?: string; sort?: string }) {
  const me = await requireUser();
  const board = boardBySlug(boardSlug);
  if (!board) notFound();
  const sub = subSlug ? subBySlug(board.slug, subSlug) : null;
  if (subSlug && !sub) notFound();
  const sort = sortOf(sortParam);

  const [{ rows, more, page }, stats, open] = await Promise.all([
    listThreads(me, { board: board.slug, topic: sub?.slug, sort, page: Number(pageParam) || 1, limit: board.market ? 24 : undefined }),
    topicStats(me, board.slug),
    board.market ? openDeals(me.id) : null,
  ]);
  const waiting = open ? open.deals.filter((d) => d.next).length + open.offers : 0;
  const base = sub ? `/forum/${board.slug}/${sub.slug}` : `/forum/${board.slug}`;
  const at = (o: { sort?: string; page?: number }) => {
    const p = new URLSearchParams();
    if ((o.sort ?? sort) !== 'recent') p.set('sort', o.sort ?? sort);
    if (o.page && o.page > 1) p.set('page', String(o.page));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const subs = board.subs as readonly Sub[];
  const empty = page > 1 ? 'Nothing further back.' : 'Nothing here yet.';

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">Forum</Link><span>/</span>
        {sub ? <><Link href={`/forum/${board.slug}`}>{board.name}</Link><span>/</span><span>{sub.name}</span></> : <span>{board.name}</span>}
      </nav>
      <div className="page-head">
        <div>
          <h1 className="title">{sub?.name ?? board.name}</h1>
          <p className="mono mute stat-line">{sub?.blurb ?? board.blurb}</p>
        </div>
        <div className="actions">
          {board.market && <Link className="btn" href="/market">Your market{waiting > 0 && <span className="count">{waiting}</span>}</Link>}
          <Link className="btn solid hide-phone" href={`/forum/${board.slug}/new${sub ? `?in=${sub.slug}` : ''}`}>{board.market ? 'New listing' : 'New thread'}</Link>
        </div>
      </div>
      {open && <OpenDeals deals={open.deals} offers={open.offers} />}

      {sub ? (
        <nav className="subcats mono" aria-label={`${board.name} sub-forums`}>
          <Link href={`/forum/${board.slug}`}>All</Link>
          {subs.map((s) => {
            const st = stats.get(`${board.slug}/${s.slug}`);
            return (
              <Link key={s.slug} href={`/forum/${board.slug}/${s.slug}`} aria-current={sub.slug === s.slug ? 'page' : undefined}>
                {s.name}{st?.unread ? <span className="new" aria-label="New activity" /> : null}
              </Link>
            );
          })}
        </nav>
      ) : (
        <SubForums board={board} stats={stats} />
      )}

      <div className="list-head">
        <span className="mono mute br">{sub ? 'Threads' : `All of ${board.name}`}</span>
        <SortTabs label="Sort" current={sort} items={SORTS.map((s) => ({ id: s.id, name: s.name, href: at({ sort: s.id }) }))} />
      </div>
      {board.market
        ? <ListingGrid rows={rows} showTopic={!sub} empty={empty} />
        : <ThreadRows rows={rows} showTopic={!sub} empty={empty} />}
      {(page > 1 || more) && (
        <nav className="pager mono" aria-label="Pages">
          {page > 1 ? <Link href={at({ page: page - 1 })}>&larr; Newer</Link> : <span />}
          <span className="mute">Page {page}</span>
          {more ? <Link href={at({ page: page + 1 })}>Older &rarr;</Link> : <span />}
        </nav>
      )}
    </>
  );
}
