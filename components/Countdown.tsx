'use client';

import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** Live time left until `to` ("2d 4h", "3h 12m", "4m 09s"); `initial` renders first, from the server. */
export default function Countdown({ to, initial }: { to: string; initial: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <>{initial}</>;
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  if (s === 0) return <>Ended</>;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return <>{d ? `${d}d ${h}h` : h ? `${h}h ${pad(m)}m` : `${m}m ${pad(s % 60)}s`}</>;
}
