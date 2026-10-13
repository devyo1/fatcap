import 'server-only';
import QRCode from 'qrcode';
import { WORDMARK, MONO } from './glyphs';

// The invite sticker: wordmark on top, a dotted QR with rounded eyes and the brand dot in the
// middle, the code underneath. Pure SVG with outlined type, so the page, the PNG download and a
// print shop all get exactly the same thing.
//
// Scanning stays safe: error correction is H (30% can be lost), the centre knockout is under 5%,
// the eyes and alignment marks keep their full shape, and there is a 4-module quiet zone.

export const DOTS = { orange: '#FF5A1F', pink: '#FF5FA2', blue: '#3D6BFF', silver: '#CFCFCF' } as const;
export type Dot = keyof typeof DOTS;
export type Paper = 'ink' | 'bone';
export const isDot = (v: unknown): v is Dot => typeof v === 'string' && v in DOTS;
export const isPaper = (v: unknown): v is Paper => v === 'ink' || v === 'bone';

const INK = '#0E0E0D', BONE = '#E4E1D9', MUTE = '#8F8C84', MUTE_ON_BONE = '#5F5D58';
const f = (n: number) => +n.toFixed(2);

/** Centres of the QR alignment marks for a version (same table the encoder uses). */
function alignment(version: number): [number, number][] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const pos = [size - 7];
  for (let i = 1; i < count - 1; i++) pos[i] = pos[i - 1] - step;
  pos.push(6);
  pos.reverse();
  const out: [number, number][] = [];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0);
      if (!corner) out.push([pos[i], pos[j]]);
    }
  }
  return out;
}

const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(2 * r - w)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(2 * r - h)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}z`;

/** Monospace text as outlines. Returns the markup and its width. */
function mono(text: string, x: number, baseline: number, cap: number, fill: string, anchor: 'start' | 'end' = 'start') {
  const s = cap / MONO.capHeight;
  const step = (MONO.advance + 60) * s; // + .06em tracking, like the site's mono labels
  const width = text.length * step - 60 * s;
  const x0 = anchor === 'end' ? x - width : x;
  const glyphs = [...text.toUpperCase()]
    .map((ch, i) => (MONO.glyphs[ch] ? `<path transform="translate(${f(i * (MONO.advance + 60))} 0)" d="${MONO.glyphs[ch]}"/>` : ''))
    .join('');
  return { svg: `<g fill="${fill}" transform="translate(${f(x0)} ${f(baseline)}) scale(${f(s * 1000) / 1000})">${glyphs}</g>`, width };
}

export function stickerSvg({ url, code, dot = 'orange', paper = 'ink', label = 'Invite' }: {
  url: string; code: string; dot?: Dot; paper?: Paper; label?: string;
}) {
  const accent = DOTS[dot];
  const ground = paper === 'ink' ? INK : BONE;
  const type = paper === 'ink' ? BONE : INK;
  const quiet = paper === 'ink' ? MUTE : MUTE_ON_BONE;

  const W = 400, P = 22, inner = W - 2 * P;

  // wordmark
  const ws = inner / WORDMARK.box.w;
  const wh = WORDMARK.box.h * ws;
  const wordmark = `<g transform="translate(${f(P - WORDMARK.box.x * ws)} ${f(P - WORDMARK.box.y * ws)}) scale(${f(ws * 1e5) / 1e5})">`
    + `<path fill="${type}" d="${WORDMARK.fatcap}${WORDMARK.club}"/><path fill="${accent}" d="${WORDMARK.dot}"/></g>`;

  // QR
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const Q = 4; // quiet zone, in modules
  const panelY = P + wh + 16;
  const c = inner / (n + 2 * Q);
  const ox = P + Q * c, oy = panelY + Q * c;
  const on = (r: number, col: number) => !!qr.modules.get(r, col);

  const eyes: [number, number][] = [[0, 0], [0, n - 7], [n - 7, 0]];
  const marks = alignment(qr.version);
  const k = n >= 29 ? 7 : 5; // centre knockout, in modules
  const k0 = Math.floor((n - k) / 2);
  const inBox = (r: number, col: number, br: number, bc: number, size: number) => r >= br && r < br + size && col >= bc && col < bc + size;
  const skip = (r: number, col: number) =>
    eyes.some(([er, ec]) => inBox(r, col, er, ec, 7))
    || marks.some(([ar, ac]) => inBox(r, col, ar - 2, ac - 2, 5))
    || inBox(r, col, k0, k0, k);

  const rad = c * 0.43;
  let dots = '';
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (!on(r, col) || skip(r, col)) continue;
      const cx = ox + (col + 0.5) * c, cy = oy + (r + 0.5) * c;
      dots += `M${f(cx - rad)} ${f(cy)}a${f(rad)} ${f(rad)} 0 1 0 ${f(2 * rad)} 0a${f(rad)} ${f(rad)} 0 1 0 ${f(-2 * rad)} 0`;
    }
  }
  let shapes = '';
  for (const [er, ec] of eyes) {
    const x = ox + ec * c, y = oy + er * c;
    shapes += roundRect(x, y, 7 * c, 7 * c, 2.1 * c) + roundRect(x + c, y + c, 5 * c, 5 * c, 1.3 * c) + roundRect(x + 2 * c, y + 2 * c, 3 * c, 3 * c, 0.9 * c);
  }
  for (const [ar, ac] of marks) {
    const x = ox + (ac - 2) * c, y = oy + (ar - 2) * c;
    shapes += roundRect(x, y, 5 * c, 5 * c, 1.4 * c) + roundRect(x + c, y + c, 3 * c, 3 * c, 0.7 * c) + roundRect(x + 2 * c, y + 2 * c, c, c, 0.5 * c);
  }
  // The brand dot sits in the knockout, square like the wordmark's.
  const ds = 3.6 * c, dcx = ox + (k0 + k / 2) * c, dcy = oy + (k0 + k / 2) * c;
  const centre = `<path fill="${accent}" d="${roundRect(dcx - ds / 2, dcy - ds / 2, ds, ds, 0.35 * c)}"/>`;

  const panel = `<path fill="${BONE}" d="${roundRect(P, panelY, inner, inner, 10)}"/>`
    + `<path fill="${INK}" fill-rule="evenodd" d="${shapes}"/><path fill="${INK}" d="${dots}"/>${centre}`;

  // footer
  const cap = 10;
  const base = panelY + inner + 18 + cap;
  const left = mono(label, P, base, cap, quiet);
  const right = mono(`[ ${code} ]`, W - P, base, cap, type, 'end');
  const H = Math.ceil(base + P);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="fatcap.club invite code ${code}">`
    + `<title>fatcap.club invite ${code}</title>`
    + `<path fill="${ground}" d="${roundRect(0, 0, W, H, 20)}"/>`
    + (paper === 'bone' ? `<path fill="none" stroke="${INK}" stroke-opacity=".18" d="${roundRect(0.5, 0.5, W - 1, H - 1, 19.5)}"/>` : '')
    + wordmark + panel + left.svg + right.svg
    + '</svg>';
}
