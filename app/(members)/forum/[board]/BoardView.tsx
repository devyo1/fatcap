import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { boardBySlug, subBySlug, type Sub } from '@/lib/config';
import { listThreads, topicStats, sortOf, SORTS } from '@/lib/threads';
import { openDeals } from '@/lib/market';
import ThreadRows from '@/components/ThreadRows';
import ListingGrid from '@/components/ListingGrid';
import DealsBanner from '@/components/DealsBanner';
import MoreRows from '@/components/MoreRows';
import ThreadCards from '@/components/ThreadCards';
import ViewToggle from '@/components/ViewToggle';
import { layoutOf } from '@/lib/view';
import { SortTabs, SubForums } from '@/components/ForumNav';

/**
 * A board (its sub-forums as rows, then every thread in it), or one sub-forum (a strip to hop
 * between siblings, then its threads). Market shows cards instead of rows.
 */
export default async function BoardView({ boardSlug, subSlug, sort: sortParam }: { boardSlug: string; subSlug?: string; sort?: string }) {
  const me = await requireUser();
  const board = boardBySlug(boardSlug);
  if (!board) notFound();
  const sub = subSlug ? subBySlug(board.slug, subSlug) : null;
  if (subSlug && !sub) notFound();
  const sort = sortOf(sortParam);
  const layout = board.market ? 'list' : await layoutOf();
  const cards = layout === 'cards';

  const size = board.market ? 24 : 30;
  const [{ rows, more }, stats, open] = await Promise.all([
    listThreads(me, { board: board.slug, topic: sub?.slug, sort, limit: size, cards }),
    topicStats(me, board.slug),
    board.market ? openDeals(me.id) : null,
  ]);
  const waiting = open ? open.deals.filter((d) => d.next).length + open.offers : 0;
  const base = sub ? `/forum/${board.slug}/${sub.slug}` : `/forum/${board.slug}`;
  const at = (s: string) => (s === 'recent' ? base : `${base}?sort=${s}`);
  const subs = board.subs as readonly Sub[];
  const empty = 'Nothing here yet.';

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
          {!board.market && <ViewToggle layout={layout} />}
          {board.market && <Link className="btn" href="/market">Your market{waiting > 0 && <span className="count">{waiting}</span>}</Link>}
          <Link className={`btn solid${board.market ? '' : ' hide-phone'}`} href={`/forum/${board.slug}/new${sub ? `?in=${sub.slug}` : ''}`}>{board.market ? 'Sell' : 'New thread'}</Link>
        </div>
      </div>
      {open && <DealsBanner deals={open.deals} offers={open.offers} />}

      {sub || board.market ? (
        <nav className="subcats mono" aria-label={`${board.name} sub-forums`}>
          <Link href={`/forum/${board.slug}`} aria-current={sub ? undefined : 'page'}>All{board.market && <span className="n">{[...stats.values()].reduce((n, s) => n + s.threads, 0)}</span>}</Link>
          {subs.map((s) => {
            const st = stats.get(`${board.slug}/${s.slug}`);
            return (
              <Link key={s.slug} href={`/forum/${board.slug}/${s.slug}`} aria-current={sub?.slug === s.slug ? 'page' : undefined}>
                {s.name}{board.market && <span className="n">{st?.threads ?? 0}</span>}{st?.unread ? <span className="new" aria-label="New activity" /> : null}
              </Link>
            );
          })}
        </nav>
      ) : (
        <SubForums board={board} stats={stats} />
      )}

      <div className="list-head">
        <span className="mono mute br">{board.market ? `${(sub ? stats.get(`${board.slug}/${sub.slug}`)?.threads : [...stats.values()].reduce((n, s) => n + s.threads, 0)) ?? 0} listings` : sub ? 'Threads' : `All of ${board.name}`}</span>
        <SortTabs label="Sort" current={sort} items={SORTS.map((s) => ({ id: s.id, name: s.name, href: at(s.id) }))} />
      </div>
      {board.market
        ? <ListingGrid rows={rows} showTopic={!sub} empty={empty} />
        : cards
          ? <ThreadCards rows={rows} empty={empty} place={!sub} />
          : <ThreadRows rows={rows} showTopic={!sub} empty={empty} />}
      {more && (
        <MoreRows
          key={`${board.slug}/${sub?.slug ?? ''}/${sort}/${layout}`} query={{ board: board.slug, topic: sub?.slug, sort, cards }}
          start={size} have={rows.map((r) => r.id)} size={size} grid={board.market} showTopic={!sub}
        />
      )}
    </>
  );
}
