'use client';

import { createContext, useContext } from 'react';

// Profile pictures: members who uploaded one get it (from the map the members layout provides,
// username key -> version); everyone else gets a generated pixel mark seeded by their username.
export const AvatarMap = createContext<Record<string, number>>({});

export function AvatarProvider({ map, children }: { map: Record<string, number>; children: React.ReactNode }) {
  return <AvatarMap.Provider value={map}>{children}</AvatarMap.Provider>;
}

const INKS = ['#E4E1D9', '#FF5FA2', '#FF5A1F', '#3D6BFF', '#CFCFCF'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export default function Avatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const map = useContext(AvatarMap);
  const key = (name ?? '?').toLowerCase();
  const v = name ? map[key] : undefined;
  if (v) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar pic" src={`/api/avatar/${encodeURIComponent(key)}?v=${v}`} width={size} height={size} alt="" loading="lazy" decoding="async" />;
  }
  let h = hash(key);
  const ink = INKS[h % INKS.length];
  const cells: [number, number][] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      if (h % 100 < 52) { cells.push([x, y]); if (x < 2) cells.push([4 - x, y]); }
    }
  }
  return (
    <svg className="avatar" width={size} height={size} viewBox="-1 -1 7 7" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="-1" y="-1" width="7" height="7" fill="#1A1A18" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={ink} />)}
    </svg>
  );
}
