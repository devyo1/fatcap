'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';

/** Settings: pick a profile picture (cropped square on the server, metadata stripped) or go back to the generated one. */
export default function AvatarUpload({ username, has }: { username: string; has: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(file: File) {
    setBusy(true); setErr('');
    try {
      let blob: Blob = file;
      if (file.size > 3.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const s = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
        c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
        blob = (await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9))) ?? file;
      }
      const body = new FormData();
      body.append('file', blob, 'avatar');
      const r = await fetch('/api/avatar', { method: 'POST', body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Upload failed.');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await fetch('/api/avatar', { method: 'DELETE' }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="avatar-upload">
      <Avatar name={username} size={72} />
      <div className="actions">
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) send(f); }} />
        <button type="button" className="btn small" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Saving...' : has ? 'Change picture' : 'Upload picture'}</button>
        {has && <button type="button" className="linkbtn mono mute" onClick={remove} disabled={busy}>Use generated</button>}
      </div>
      {err ? <p className="attach-err mono" role="alert">{err}</p> : <p className="hint mono">Square crop. Location and camera data are removed.</p>}
    </div>
  );
}
