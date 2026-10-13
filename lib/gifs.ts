import 'server-only';

// GIF search through GIPHY, done by the server so members' devices never talk to GIPHY:
// searches go out from our server (no member IP, no cookies), previews stream back through
// /api/gif/p, and a picked GIF is downloaded, re-encoded and stored like any other upload.
// Needs GIPHY_API_KEY (developers.giphy.com). Without it, the GIF button doesn't show.
const KEY = process.env.GIPHY_API_KEY || '';
const RATING = ['g', 'pg', 'pg-13', 'r'].includes(process.env.GIPHY_RATING ?? '') ? process.env.GIPHY_RATING! : 'pg-13';
export const gifsOn = () => !!KEY;

type Rendition = { url?: string; width?: string; height?: string; size?: string; webp?: string };
type GiphyGif = { id: string; title?: string; images: Record<string, Rendition> };

export type GifResult = { id: string; title: string; w: number; h: number; preview: string };

/** Only GIPHY's media hosts can be fetched; anything else is refused. */
export function giphyMediaUrl(raw: string | undefined | null): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const ok = u.protocol === 'https:' && (/^media\d*\.giphy\.com$/.test(u.hostname) || u.hostname === 'i.giphy.com');
    return ok ? u : null;
  } catch {
    return null;
  }
}

async function giphy(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ api_key: KEY, rating: RATING, bundle: 'messaging_non_clips', ...params });
  const r = await fetch(`https://api.giphy.com/v1/gifs/${path}?${qs}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`giphy ${r.status}`);
  return r.json();
}

/** A page of search results (or trending when there's no query), with previews routed through us. */
export async function searchGifs(query: string, offset: number) {
  const json: { data: GiphyGif[]; pagination?: { total_count: number; count: number; offset: number } } = query
    ? await giphy('search', { q: query.slice(0, 50), limit: '24', offset: String(offset), lang: 'en' })
    : await giphy('trending', { limit: '24', offset: String(offset) });
  const results: GifResult[] = [];
  for (const g of json.data ?? []) {
    const pv = g.images.fixed_width_small ?? g.images.fixed_width ?? g.images.preview_gif;
    const src = giphyMediaUrl(pv?.webp ?? pv?.url);
    if (!src) continue;
    results.push({ id: g.id, title: g.title ?? '', w: Number(pv?.width) || 100, h: Number(pv?.height) || 100, preview: `/api/gif/p?u=${encodeURIComponent(src.toString())}` });
  }
  const p = json.pagination;
  const next = p && p.offset + p.count < p.total_count ? p.offset + p.count : null;
  return { results, next };
}

/** The bytes of one GIF (a mid-size rendition), fetched by id so the client can't point us anywhere else. */
export async function fetchGif(id: string): Promise<Buffer | null> {
  if (!/^[A-Za-z0-9]{4,40}$/.test(id)) return null;
  const json: { data?: GiphyGif } = await giphy(id, {});
  const im = json.data?.images ?? {};
  const pick = [im.downsized_medium, im.downsized, im.fixed_height, im.original].find((r) => r?.url && Number(r.size ?? 0) <= 6_000_000);
  const url = giphyMediaUrl(pick?.url);
  if (!url) return null;
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.length <= 8_000_000 ? buf : null;
}
