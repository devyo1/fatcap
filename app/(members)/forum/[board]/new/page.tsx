import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LIMITS, boardBySlug, subBySlug } from '@/lib/config';
import { createThread } from '@/app/actions';
import { createListing } from '@/app/market-actions';
import ListingForm from '@/components/ListingForm';
import PlacePicker from '@/components/PlacePicker';
import VanishPicker from '@/components/VanishPicker';
import Notice from '@/components/Notice';
import Writer from '@/components/Writer';

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }) {
  return { title: boardBySlug((await params).board)?.market ? 'New listing' : 'New thread' };
}

export default async function NewThread({ params, searchParams }: { params: Promise<{ board: string }>; searchParams: Promise<{ error?: string; in?: string }> }) {
  const board = boardBySlug((await params).board);
  if (!board) notFound();
  const sp = await searchParams;
  const sub = subBySlug(board.slug, sp.in);
  const market = board.market;

  return (
    <>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link href="/forum">Forum</Link><span>/</span><Link href={`/forum/${board.slug}`}>{board.name}</Link><span>/</span>{sub && <><Link href={`/forum/${board.slug}/${sub.slug}`}>{sub.name}</Link><span>/</span></>}<span>New</span>
      </nav>
      <div className="page-head"><h1 className="title">{market ? 'New listing' : 'New thread'}</h1></div>
      <Notice error={sp.error} />
      {market ? (
        <ListingForm
          action={createListing} submit="Post listing"
          defaults={{ place: sub ? `${board.slug}/${sub.slug}` : '' }}
          cancelHref={sub ? `/forum/${board.slug}/${sub.slug}` : `/forum/${board.slug}`}
        />
      ) : (
      <form action={createThread} className="stack compose-form">
        <div className="field-row">
          <div className="field">
            <label className="mono" htmlFor="place">Section</label>
            <PlacePicker id="place" scope={market ? 'market' : 'forum'} defaultValue={sub ? `${board.slug}/${sub.slug}` : undefined} />
          </div>
          {market && (
            <div className="field">
              <label className="mono" htmlFor="price">Price</label>
              <input data-draft className="input" id="price" name="price" maxLength={LIMITS.price} placeholder="$15, trade, free" autoComplete="off" />
            </div>
          )}
        </div>
        <div className="field">
          <label className="mono" htmlFor="title">Title</label>
          <input data-draft className="input big" id="title" name="title" maxLength={LIMITS.title} required autoComplete="off" />
        </div>
        <div className="field">
          <label className="mono" htmlFor="body">{market ? 'Details' : 'Post'}</label>
          <Writer id="body" rows={12} maxLength={LIMITS.body} hint="## heading  **bold**  *italic*  > quote  --- break" />
          <span className="hint mono">Images go where the cursor is. Text after an image, on the same line, becomes its caption.</span>
        </div>
        <div className="field">
          <label className="mono" htmlFor="vanish">Vanish</label>
          <VanishPicker id="vanish" />
          <span className="hint mono">Deletes the thread, replies and images for good.</span>
        </div>
        <div className="actions">
          <button className="btn solid" type="submit">{market ? 'Post listing' : 'Post'}</button>
          <Link className="mono mute" href={sub ? `/forum/${board.slug}/${sub.slug}` : `/forum/${board.slug}`}>Cancel</Link>
        </div>
      </form>
      )}
    </>
  );
}
