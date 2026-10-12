import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="gate">
      <div className="card">
        <span className="mono mute br">404</span>
        <h1 className="wide big">Nothing here<span className="dot">.</span></h1>
        <Link className="mono mute" href="/">fatcap.club</Link>
      </div>
    </div>
  );
}
