'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Attach from './Attach';
import GifButton from './GifButton';
import RichText from './RichText';

/**
 * The text box used for posts, comments and messages: grows as you write (long posts welcome),
 * with Image, GIF and Preview. Preview shows the post as it will look, pictures in place.
 * `children` sit at the right end of the bar (usually the submit button).
 */
export default function Writer({ id, name = 'body', rows = 4, maxLength, placeholder, defaultValue, draft = true, autoFocus, hint, previewable = true, children }: {
  id: string; name?: string; rows?: number; maxLength: number; placeholder?: string; defaultValue?: string;
  draft?: boolean; autoFocus?: boolean; hint?: string; previewable?: boolean; children?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const grow = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, Math.max(window.innerHeight * 0.75, 320))}px`;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(grow, 60); // after a restored draft lands
    el.addEventListener('input', grow);
    // An empty submit while previewing goes back to the text box.
    const back = () => setPreview(null);
    el.addEventListener('invalid', back);
    return () => { clearTimeout(t); el.removeEventListener('input', grow); el.removeEventListener('invalid', back); };
  }, [grow]);

  return (
    <div className={`writer${preview !== null ? ' previewing' : ''}`}>
      <textarea
        ref={ref} id={id} name={name} className="textarea" rows={rows} maxLength={maxLength} required placeholder={placeholder}
        defaultValue={defaultValue} data-draft={draft ? '' : undefined} autoFocus={autoFocus}
      />
      {preview !== null && (
        <div className="writer-preview">
          {preview.trim() ? <RichText text={preview} /> : <p className="mono mute">Nothing to preview.</p>}
        </div>
      )}
      <div className="writer-bar">
        <span className="writer-tools">
          <Attach target={id} />
          <GifButton target={id} />
          {previewable && (
            <button
              type="button" className={`chip${preview !== null ? ' on' : ''}`} aria-pressed={preview !== null}
              onClick={() => setPreview((p) => (p === null ? ref.current?.value ?? '' : null))}
            >{preview === null ? 'Preview' : 'Write'}</button>
          )}
        </span>
        {hint && <span className="hint mono writer-hint">{hint}</span>}
        {children && <span className="writer-end">{children}</span>}
      </div>
    </div>
  );
}
