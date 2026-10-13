'use client';

import { useRef, useState } from 'react';
import { mediaUrl } from '@/lib/media-token';
import { picAttrs } from './RichText';

export type GalleryPic = { id: string; w: number; h: number; anim: boolean };

/** A listing's photos, one at a time: swipe (or the dots) to move, tap to open the full picture. */
export default function ListingGallery({ pics, title }: { pics: GalleryPic[]; title: string }) {
  const [at, setAt] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const go = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  return (
    <div className="gallery">
      <div
        className="gallery-track" ref={track} data-no-pull
        onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
      >
        {pics.map((p, i) => (
          <a key={p.id} className="pic" href={mediaUrl(p.id)} target="_blank" rel="noopener" aria-label={`Photo ${i + 1} of ${pics.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...picAttrs(p.id, p, '(max-width: 900px) 100vw, 560px')} alt={i === 0 ? title : ''} loading={i ? 'lazy' : 'eager'} decoding="async" />
          </a>
        ))}
      </div>
      {pics.length > 1 && (
        <>
          <span className="gallery-n mono">{at + 1} / {pics.length}</span>
          <div className="gallery-dots" role="tablist" aria-label="Photos">
            {pics.map((p, i) => (
              <button key={p.id} type="button" role="tab" aria-selected={i === at} aria-label={`Photo ${i + 1}`} onClick={() => go(i)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
