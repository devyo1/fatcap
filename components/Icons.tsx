// Small line icons used across the forum. 16px, stroke follows text color.
const base = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const Hourglass = () => <svg {...base}><path d="M4 2h8M4 14h8M5 2c0 3 6 3.5 6 6s-6 3-6 6M11 2c0 3-6 3.5-6 6s6 3 6 6" /></svg>;
export const ImageIcon = () => <svg {...base}><rect x="2" y="3" width="12" height="10" rx="1" /><circle cx="6" cy="6.5" r="1.2" /><path d="m3 12 3.5-3.5L9 11l2-2 3 3" /></svg>;
export const Pin = () => <svg {...base}><path d="M10 2 14 6l-2.5 1-3 3 .5 3L3 7.5l3-.5 3-3z" /><path d="m5.5 10.5-3 3" /></svg>;
export const Lock = () => <svg {...base}><rect x="3.5" y="7" width="9" height="7" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>;
export const Bookmark = ({ on = false }: { on?: boolean }) => <svg {...base} fill={on ? 'currentColor' : 'none'}><path d="M4 2h8v12l-4-3-4 3z" /></svg>;
export const Bell = ({ on = false }: { on?: boolean }) => <svg {...base} fill={on ? 'currentColor' : 'none'}><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z" /><path d="M6.5 14a1.5 1.5 0 0 0 3 0" /></svg>;
export const Heart = ({ on = false }: { on?: boolean }) => <svg {...base} fill={on ? 'currentColor' : 'none'}><path d="M8 13.5S2.5 10.2 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3c0 3.9-5.5 7.2-5.5 7.2z" /></svg>;
export const Reply = () => <svg {...base}><path d="M6.5 4 2.5 8l4 4" /><path d="M2.5 8H9a4.5 4.5 0 0 1 4.5 4.5V13" /></svg>;
export const Quote = () => <svg {...base}><path d="M3 9.5V7a3 3 0 0 1 3-3M3 9.5h3v3.5H3zM9.5 9.5V7a3 3 0 0 1 3-3M9.5 9.5h3v3.5h-3z" /></svg>;
export const Bubble = () => <svg {...base}><path d="M2.5 3.5h11v7.5H6l-3.5 3z" /></svg>;
export const More = () => <svg {...base}><circle cx="3.5" cy="8" r=".8" fill="currentColor" /><circle cx="8" cy="8" r=".8" fill="currentColor" /><circle cx="12.5" cy="8" r=".8" fill="currentColor" /></svg>;
export const Minus = () => <svg {...base}><path d="M4 8h8" /></svg>;
export const Plus = () => <svg {...base}><path d="M4 8h8M8 4v8" /></svg>;
export const Gavel = () => <svg {...base}><path d="m9.5 2.5 4 4M8 4l4 4M7.2 4.8 11.2 8.8M10 7 4 13a1.4 1.4 0 0 1-2-2l6-6M2.5 14.5h6" /></svg>;
const nav = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
export const NavForum = () => <svg {...nav}><path d="M4 5h16M4 12h16M4 19h10" /></svg>;
export const NavChat = () => <svg {...nav}><path d="M4 5h16v11H9l-5 4z" /></svg>;
export const NavMarket = () => <svg {...nav}><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.4" /></svg>;
export const NavPlus = () => <svg {...nav} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>;
export const NavSearch = () => <svg {...nav}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></svg>;
