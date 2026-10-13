'use client';

import { useRef, useState } from 'react';
import { setLike, setFollow, setSave } from '@/app/social-actions';
import { Heart, Bell, Bookmark } from './Icons';
import { haptic } from '@/lib/haptics';

// What this tab has switched, so a page shown again from the router's cache (going back) agrees.
const known = new Map<string, boolean>();

/**
 * A switch that flips the moment you tap it and settles with the server behind it: one request
 * at a time, and if you tapped again meanwhile, the last tap wins. If the request fails it
 * flips back.
 */
function useSwitch(key: string, server: boolean, send: (on: boolean) => Promise<boolean>) {
  const [on, setOn] = useState(() => known.get(key) ?? server);
  const want = useRef(on);
  const busy = useRef(false);
  const flip = () => {
    want.current = !want.current;
    setOn(want.current);
    known.set(key, want.current);
    haptic(6);
    if (busy.current) return;
    const run = async () => {
      busy.current = true;
      const goal = want.current;
      try {
        const got = await send(goal);
        if (want.current === goal) { want.current = got; setOn(got); known.set(key, got); }
      } catch {
        if (want.current === goal) { want.current = !goal; setOn(!goal); known.set(key, !goal); }
      }
      busy.current = false;
      if (want.current !== goal) void run();
    };
    void run();
  };
  return [on, flip] as const;
}

/** Like a thread or comment. The count moves with you; others' likes show on the next load. */
export function LikeButton({ target, id, count, mine, label = true }: { target: 'thread' | 'post'; id: number; count: number; mine: boolean; label?: boolean }) {
  const [on, flip] = useSwitch(`like:${target}:${id}`, mine, (v) => setLike(target, id, v).then((r) => r.on));
  const [pop, setPop] = useState(false);
  const n = count - (mine ? 1 : 0) + (on ? 1 : 0);
  return (
    <button
      type="button" className={`act like${on ? ' on' : ''}${pop ? ' pop' : ''}`} aria-pressed={on} aria-label={on ? 'Unlike' : 'Like'}
      onClick={() => { setPop(!on); flip(); }} onAnimationEnd={() => setPop(false)}
    >
      <Heart on={on} /><span>{n || (label ? 'Like' : '')}</span>
    </button>
  );
}

/** Follow a thread for alerts on new comments. */
export function FollowButton({ id, following }: { id: number; following: boolean }) {
  const [on, flip] = useSwitch(`follow:${id}`, following, (v) => setFollow(id, v).then((r) => r.on));
  return (
    <button type="button" className={`act${on ? ' on' : ''}`} aria-pressed={on} title="Alerts for new comments" onClick={flip}>
      <Bell on={on} /><span>{on ? 'Following' : 'Follow'}</span>
    </button>
  );
}

/** Save a thread to your private list. `compact`: the icon alone. */
export function SaveButton({ id, saved, compact = false }: { id: number; saved: boolean; compact?: boolean }) {
  const [on, flip] = useSwitch(`save:${id}`, saved, (v) => setSave(id, v).then((r) => r.on));
  return (
    <button type="button" className={`act${on ? ' on' : ''}`} aria-pressed={on} aria-label={on ? 'Saved' : 'Save'} onClick={flip}>
      <Bookmark on={on} />{!compact && <span>{on ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
