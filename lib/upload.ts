// Uploading a picture from the browser. Big photos (and HEIC from iPhones) get shrunk here first so
// they fit the upload limit; the server re-encodes everything again anyway, which is what strips
// metadata. Shared by the composer's image button and the zine builder.

const MAX = 4 * 1024 * 1024;
const AS_IS = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);

export async function prepare(file: File): Promise<Blob> {
  if (AS_IS.has(file.type) && file.size <= MAX) return file;
  if (file.type === 'image/gif') throw new Error('That GIF is over 4 MB. Try a shorter one.');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) throw new Error("This browser can't read that file. Try a JPG or PNG.");
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.88));
  if (!blob || blob.size > MAX) throw new Error('That image is too big.');
  return blob;
}

/**
 * A PDF's pages as pictures, one at a time, rendered here in the browser (so a big file never has
 * to be uploaded whole): wide enough to read full screen, white paper behind. `onPage` gets each
 * page as a JPEG as soon as it's drawn.
 */
export async function pdfPages(file: File, max: number, onPage: (jpeg: File, n: number, total: number, ratio: number) => Promise<void>) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const all = doc.numPages;
  const total = Math.min(all, max);
  let ratio = 0;
  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    if (n === 1) ratio = base.width / base.height;
    const vp = page.getViewport({ scale: Math.min(3, 1400 / base.width) });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86));
    c.width = c.height = 0;
    if (!blob) throw new Error(`Couldn't draw page ${n}.`);
    await onPage(new File([blob], `page-${n}.jpg`, { type: 'image/jpeg' }), n, total, base.width / base.height);
  }
  await doc.destroy();
  return { pages: all, ratio };
}

/** Upload one picture; resolves to its id. Throws with a message a person can read. */
export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Images only.');
  const body = new FormData();
  body.append('file', await prepare(file), 'upload');
  const r = await fetch('/api/media', { method: 'POST', body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw new Error(d.error || 'Upload failed.');
  return d.id as string;
}
