'use client';

import { useState } from 'react';
import { setCollectionShown } from '@/app/social-actions';
import { haptic } from '@/lib/haptics';

/** The setting for showing the zines and books you own on your profile. Saves as you flip it (and flips back if it couldn't). */
export default function CollectionSwitch({ shown }: { shown: boolean }) {
  const [on, setOn] = useState(shown);
  const flip = async () => {
    const next = !on;
    haptic(6);
    setOn(next);
    try { setOn((await setCollectionShown(next)).on); } catch { setOn(!next); }
  };
  return (
    <button type="button" role="switch" aria-checked={on} className="setting-switch" onClick={flip}>
      <span>Show the zines and books I own on my profile</span>
      <span className={`switch${on ? ' on' : ''}`} aria-hidden="true" />
    </button>
  );
}
