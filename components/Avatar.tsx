// Generated pixel avatar: a mirrored 5x5 grid seeded by the username, so everyone
// gets a stable mark without uploading anything.
const INKS = ['#E4E1D9', '#FF5FA2', '#FF5A1F', '#3D6BFF', '#CFCFCF'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export default function Avatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const key = (name ?? '?').toLowerCase();
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
